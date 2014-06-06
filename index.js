var express = require('express'),
    config = require('./config'),
    bodyParser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    jadeDynamicIncludes = require('jade-dynamic-includes');
    session = require('express-session'),
    flash = require('connect-flash'),
    async = require('async'),
    _ = require('lodash');

var SpotlightRepo = require('./src/spotlight_repo'),
    CollectorRepo = require('./src/collector_repo'),
    Jenkins = require('./src/jenkins'),
    Dashboards = require('./src/dashboards'),
    GitConfig = require('./src/git_config'),
    GovUK = require('./src/govuk.js'),
    ModuleHelper = require('./src/module_helper.js'),
    Stagecraft = require('./src/stagecraft.js'),
    modules = require('./src/modules.json');

var app = express(),
    spotlightRepo = SpotlightRepo.fromConfig(config.spotlight, config.development),
    collectorRepo = CollectorRepo.fromConfig(config.collectors, config.development),
    jenkins = Jenkins.fromConfig(config.jenkins, config.development),
    gitConfig = new GitConfig(),
    govuk = GovUK.fromConfig(config.govuk),
    stagecraft = Stagecraft.fromConfig(config.stagecraft, config.development),
    moduleHelper = new ModuleHelper(modules, collectorRepo);
    tmpDashboardStore = {};

async.parallel([
    spotlightRepo.open.bind(spotlightRepo),
    collectorRepo.open.bind(collectorRepo)
], function() {

  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');

  jadeDynamicIncludes.initTemplates('views/modules', true);
  app.use(jadeDynamicIncludes.attachTemplatesToRequest());

  app.use(express.static('public'));
  app.use(bodyParser());

  // Session
  app.use(cookieParser('super-secret-string'));
  app.use(session({ cookie: { maxAge: 43200 }})); // 12 hours

  app.use(flash());

  gitConfig.getCommitterMetadata(function (err, data) {
    if (err) {
      console.error('Error getting committer metadata:', err);
    }

    app.set('committer', data);
  });

  var dashboardCreationBaseView = {
    'moduleHelper': moduleHelper,
    'dashboard': {},
    'departments': spotlightRepo.departments,
    'agencies': spotlightRepo.agencies,
    'customer_types': spotlightRepo.customerTypes,
    'business_models': spotlightRepo.businessModels
  };

  app.get('/', function (req, res) {
    var groupedDashboards = Dashboards.splitByType(spotlightRepo.dashboards);

    groupedDashboards = Object.keys(groupedDashboards).reduce(
      function(out, dashboardGroup) {
        var dashboards = groupedDashboards[dashboardGroup];
        out[dashboardGroup] =
          Dashboards.alphabetise(dashboards);
        return out;
      }, {});


    res.render('index', {
      "groupedDashboards": groupedDashboards,
      "messages": req.flash('info'),
      "errors": req.flash('error')
    });
  });

  app.get('/dashboard/new', function (req, res) {
    res.render('add', {
      'errors': req.flash('error')
    });
  });

  app.get('/dashboard/create', function (req, res) {
    var dashboard = {
          'relatedPages': {}
        },
        govUKStartPage;

    if (req.query['govuk-url']) {
      govUKStartPage = req.query['govuk-url'].trim().toLowerCase();
    }

    if (govUKStartPage && govUKStartPage.substring(0, 19) !== 'https://www.gov.uk/') {
      req.flash('error', 'The start page URL you provided doesn\'t begin with https://www.gov.uk/');
      res.redirect('/dashboard/new');
    } else if (govUKStartPage) {
      govuk.fromStartPage(govUKStartPage, function(err, json) {
        if (err) {
          req.flash('error', 'Could not find the start page ' + govUKStartPage);
          res.redirect('/dashboard/new');
        } else {
          dashboard = _.merge(dashboard, json, { slug: govUKStartPage.substring(19) });
          res.render('create',
            _.merge(dashboardCreationBaseView, {
              'action': '/dashboard/create',
              'dashboard': dashboard,
              'modules': moduleHelper.parse(dashboard)
            })
          );
        }
      });
    } else {
      res.render('create',
        _.merge(dashboardCreationBaseView, {
          'action': '/dashboard/create',
          'dashboard': dashboard,
          'modules': moduleHelper.parse(dashboard)
        })
      );
    }
  });

  app.post('/dashboard/create', function (req, res) {
    var dashboard = {
      'published': false,
      'page-type': 'dashboard',
      'dashboard-type': 'transaction',
      'strapline': 'Dashboard',
      'relatedPages': {}
    };

    saveDashboard(true, dashboard, req.body.commit_message, req, res);
  });

  app.get(/\/dashboard\/(.+)\/edit/, function (req, res) {
    var dashboard = spotlightRepo.selectDashboard(req.params[0]);

    res.render('edit',
      _.merge(dashboardCreationBaseView, {
        'action': '/dashboard/' + dashboard.slug + '/edit',
        'dashboard': dashboard,
        'modules': moduleHelper.parse(dashboard)
      })
    );
  });

  app.get(/\/dashboard\/(.+)\/rescue/, function(req, res) {
    var rescued = tmpDashboardStore[req.params[0]];

    res.render(rescued.isNew ? 'create' : 'edit',
      _.merge(dashboardCreationBaseView, {
        'action': rescued.isNew ? '/dashboard/create' : '/dashboard/' + rescued.dashboard.slug + '/edit',
        'dashboard': rescued.dashboard,
        'isNew': rescued.isNew,
        'errors': req.flash('error')
      })
    );
  });

  app.post(/\/dashboard\/(.+)\/edit/, function (req, res) {
    saveDashboard(false, spotlightRepo.selectDashboard(req.params[0]), req.body.commit_message, req, res);
  });

  function createDashboard (existingDashboard, form) {
    var otherLinks = [];

    if (!existingDashboard.slug) {
      existingDashboard.slug = form.dashboard_slug;
    }

    existingDashboard.title = form.dashboard_title;
    existingDashboard.description = form.dashboard_description;
    existingDashboard['customer-type'] = form.dashboard_customer_type;
    existingDashboard['business-model'] = form.dashboard_business_model;
    existingDashboard['description-extra'] = form.dashboard_description_extra;

    if (form.dashboard_start_page_url) {
      existingDashboard.relatedPages.transaction = {
        url: form.dashboard_start_page_url,
        title: form.dashboard_start_page_title
      };
    }

    if (form.dashboard_link_url) {
      if (_.isArray(form.dashboard_link_url)) {
        for (var i = 0; i < form.dashboard_link_url.length; i++) {
          otherLinks.push({
            url: form.dashboard_link_url[i],
            title: form.dashboard_link_title[i]
          });
        }
      } else {
        otherLinks.push({
          url: form.dashboard_link_url,
          title: form.dashboard_link_title
        });
      }

      existingDashboard.relatedPages.other = otherLinks;
    }

    existingDashboard.department = form.dashboard_department;
    existingDashboard.agency = form.dashboard_agency;

    return existingDashboard;
  }

  function sanitiseCommitMessage (commitMessage) {
    return commitMessage.replace(/"/g, '\'');
  }

  function saveDashboard(isNew, existingDashboard, commitMessage, req, res) {
    var tmpId = '' + Date.now() + Math.round(Math.random() * 1000000),
        redirectUrl = '/dashboard/' + tmpId + '/rescue',
        newDashboard = createDashboard(existingDashboard, req.body),
        strippedModules = moduleHelper.strip(newDashboard.modules),
        newModules = moduleHelper.generateModules(newDashboard.slug, req.body),
        newCollectors = moduleHelper.generateCollectors(newDashboard.slug, req.body),
        sanitisedCommitMessage = sanitiseCommitMessage(commitMessage);

    newDashboard.modules = newModules.concat(strippedModules);

    tmpDashboardStore[tmpId] = { isNew: isNew, dashboard: newDashboard };

    async.series([
      stagecraft.createDataSetsForCollectors.bind(stagecraft, newCollectors),
      collectorRepo.saveAll.bind(collectorRepo, newCollectors, sanitisedCommitMessage),
      jenkins.deploy.bind(jenkins, 'collectors-deploy', {
        APPLICATION_VERSION: 'master',
        APPLICATION_NAME: 'performanceplatform-collector'
      }),
      spotlightRepo.save.bind(spotlightRepo, isNew, newDashboard, sanitisedCommitMessage),
      jenkins.deploy.bind(jenkins, 'spotlight-config-deploy', {
        APPLICATION_VERSION: 'master'
      })
    ], function(err, results) {
      if (err) {
        console.error(err);
        req.flash('error', err.message ? err.message : err);
        res.redirect(redirectUrl);
      } else {
          var cachebust = Math.floor(Math.random() * (999999) + 999999);
          var updateMessage = [
            'Your changes to <a href="https://www.preview.alphagov.co.uk/performance/',
            newDashboard.slug,
            '?cachebust=', cachebust,
            '" target="_blank"> the &ldquo;',
            newDashboard.title,
            '&rdquo; dashboard</a> have been saved. ',
            'GOV.UK preview update in progress&hellip;',
            '<div id="deploy-progress" class="progress"><div class="progress-bar" style="width:0%;"></div></div>'
          ].join('');
          req.flash('info', updateMessage);
          res.redirect('/');
      }
    });
  }

  app.post(/\/dashboard\/(.+)\/publish/, function (req, res) {
    var dashboard = spotlightRepo.selectDashboard(req.params[0]);

    dashboard.published = true;

    saveDashboard(false, dashboard, 'Publish \'' + dashboard.title + '\' dashboard', req, res);
  });

  app.listen(3000);

  console.log('Performance Platform dashboard admin is ready at http://localhost:3000/ ...');
});

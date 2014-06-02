var express = require('express'),
    config = require('./config'),
    bodyParser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    session = require('express-session'),
    flash = require('connect-flash');

var StubRepo = require('./src/stub_repo'),
    Jenkins = require('./src/jenkins'),
    Dashboards = require('./src/dashboards'),
    GitConfig = require('./src/git_config');

var app = express(),
    repo = StubRepo.fromConfig(config.stub),
    jenkins = Jenkins.fromConfig(config.jenkins),
    gitConfig = new GitConfig();

repo.open(function() {

  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');

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

  app.get('/', function (req, res) {
    var groupedDashboards = Dashboards.splitByType(repo.dashboards);

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
    if (req.query['govuk-url']) {
      var govUKStartPage = req.query['govuk-url'].trim().toLowerCase();
    }

    if (govUKStartPage && govUKStartPage.substring(0, 19) !== 'https://www.gov.uk/') {
      req.flash('error', 'The start page URL you provided doesn\'t begin with https://www.gov.uk/');
      res.redirect('/dashboard/new');
    } else {
      res.render('create', {
        'action': '/dashboard/create',
        'dashboard': {
          'department': {}
        },
        'departments': repo.departments,
        'customer_types': repo.customerTypes,
        'business_models': repo.businessModels
      });
    }
  });

  app.post('/dashboard/create', function (req, res) {
    var dashboard = {
      'published': false,
      'page-type': 'dashboard',
      'dashboard-type': 'transaction',
      'strapline': 'Dashboard'
    };

    var newDashboard = createDashboard(dashboard, req.body);

    saveRepo(newDashboard, req.body.commit_message, req, res);
  });

  app.get(/\/dashboard\/(.+)\/edit/, function (req, res) {
    var dashboard = repo.selectDashboard(req.params[0]);
    res.render('edit', {
      "action": '/dashboard/' + dashboard.slug + '/edit',
      "dashboard": dashboard,
      "departments": repo.departments,
      "customer_types": repo.customerTypes,
      "business_models": repo.businessModels
    });
  });

  app.post(/\/dashboard\/(.+)\/edit/, function (req, res) {
    var dashboard = repo.selectDashboard(req.params[0]);

    var newDashboard = createDashboard(dashboard, req.body);

    saveRepo(newDashboard, req.body.commit_message, req, res);
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
      existingDashboard.relatedPages.transaction.url = form.dashboard_start_page_url;
      existingDashboard.relatedPages.transaction.title = form.dashboard_start_page_title;
    }

    if (form.dashboard_link_url) {
      for (var i = 0; i < form.dashboard_link_url.length; i++) {
        otherLinks.push({
          url: form.dashboard_link_url[i],
          title: form.dashboard_link_title[i]
        });
      }

      existingDashboard.relatedPages.other = otherLinks;
    }

    existingDashboard.department = repo.departments.filter(function(d) {
      return d.title === form.dashboard_department;
    })[0];

    return existingDashboard;
  }

  app.post(/\/dashboard\/(.+)\/publish/, function (req, res) {
    var dashboard = repo.selectDashboard(req.params[0]);

    dashboard.published = true;

    saveRepo(dashboard, 'Publish \'' + dashboard.title + '\' dashboard', req, res);
  });

  function sanitiseCommitMessage (commitMessage) {
    return commitMessage.replace(/"/g, '\'');
  }

  function saveRepo (dashboard, commitMessage, req, res) {
    repo.save(dashboard, sanitiseCommitMessage(commitMessage), function (err) {
      if (err) {
        console.error(err);
      } else {
        jenkins.deploy(function (err) {
          if (err) {
            console.error(err);
            req.flash('error', err.message + ' Your changes have been made and are safe.');
            res.redirect('/');
          } else {
            var updateMessage = [
              'Your changes to <a href="https://www.preview.alphagov.co.uk/performance/',
              dashboard.slug,
              '" target="_blank"> the &ldquo;',
              dashboard.title,
              '&rdquo; dashboard</a> have been saved. ',
              'GOV.UK preview update in progress&hellip;'
            ].join('');
            req.flash('info', updateMessage);
            res.redirect('/');
          }
        });
      }
    });
  }

  app.listen(3000);

  console.log('Performance Platform dashboard admin is ready at http://localhost:3000/ ...');
});

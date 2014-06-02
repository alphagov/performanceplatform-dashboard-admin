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
    var govUKStartPage = req.query['govuk-url'].trim().toLowerCase();

    if (govUKStartPage && govUKStartPage.substring(0, 19) !== 'https://www.gov.uk/') {
      req.flash('error', 'The start page URL you provided doesn\'t begin with https://www.gov.uk/');
      res.redirect('/dashboard/new');
    } else {
      res.render('create', {});
    }
  });

  app.get(/\/dashboard\/(.+)\/edit/, function (req, res) {
    var dashboard = repo.selectDashboard(req.params[0]);
    res.render('edit', {
      "dashboard": dashboard,
      "departments": repo.departments,
      "customer_types": repo.customerTypes,
      "business_models": repo.businessModels
    });
  });

  app.post(/\/dashboard\/(.+)\/edit/, function (req, res) {
    var dashboard = repo.selectDashboard(req.params[0]),
        otherLinks = [];

    dashboard.title = req.body.dashboard_title;
    dashboard.description = req.body.dashboard_description;
    dashboard['customer-type'] = req.body.dashboard_customer_type;
    dashboard['business-model'] = req.body.dashboard_business_model;
    dashboard['description-extra'] = req.body.dashboard_description_extra;
    dashboard.relatedPages.transaction.url = req.body.dashboard_start_page_url;
    dashboard.relatedPages.transaction.title = req.body.dashboard_start_page_title;

    for (var i = 0; i < req.body.dashboard_link_url.length; i++) {
      otherLinks.push({
        url: req.body.dashboard_link_url[i],
        title: req.body.dashboard_link_title[i]
      });
    }

    dashboard.relatedPages.other = otherLinks;

    dashboard.department = repo.departments.filter(function(d) {
      return d.title === req.body.dashboard_department;
    })[0];

    saveRepo(dashboard, req.body.commit_message, req, res);
  });

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

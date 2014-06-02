var express = require('express'),
    config = require('./config'),
    bodyParser = require('body-parser');
    
var StubRepo = require('./src/stub_repo'),
    Jenkins = require('./src/jenkins'),
    Dashboards = require('./src/dashboards');

var app = express(),
    repo = StubRepo.fromConfig(config.stub),
    jenkins = Jenkins.fromConfig(config.jenkins);

repo.open(function() {

  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');

  app.use(express.static('public'));
  app.use(bodyParser());

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
      "groupedDashboards": groupedDashboards
    });
  });

  app.get(/\/dashboard\/(.+)\/edit/, function (req, res) {
    var dashboard = repo.selectDashboard(req.params[0]);
    res.render('edit', {
      "dashboard": dashboard
    });
  });

  app.post(/\/dashboard\/(.+)\/edit/, function (req, res) {
    var dashboard = repo.selectDashboard(req.params[0]);

    dashboard.title = req.body.dashboard_title;
    dashboard.description = req.body.dashboard_description;

    saveRepo(dashboard, req.body.commit_message, res);
  });

  app.post(/\/dashboard\/(.+)\/publish/, function (req, res) {
    var dashboard = repo.selectDashboard(req.params[0]);

    dashboard.published = true;

    saveRepo(dashboard, 'Publish \'' + dashboard.title + '\' dashboard', res);
  });

  function sanitiseCommitMessage (commitMessage) {
    return commitMessage.replace(/"/g, '\'');
  }

  function saveRepo (dashboard, commitMessage, res) {
    repo.save(dashboard, sanitiseCommitMessage(commitMessage), function (err) {
      if (err) {
        console.error(err);
      } else {
        jenkins.deploy(function () {
          res.redirect('/');
        });
      }
    });
  }

  app.listen(3000);

});

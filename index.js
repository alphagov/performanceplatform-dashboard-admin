var express = require('express'),
    config = require('./config'),
    StubRepo = require('./src/stub_repo'),
    Jenkins = require('./src/jenkins'),
    bodyParser = require('body-parser');

var app = express(),
    repo = StubRepo.fromConfig(config.stub),
    jenkins = Jenkins.fromConfig(config.jenkins);

repo.open(function() {

  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');

  app.use(express.static('public'));
  app.use(bodyParser());

  app.get('/', function (req, res) {
    res.render('index', { "dashboards": repo.dashboards });
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

    repo.save(dashboard, function (err) {
      if (err) {
        console.error(err);
      } else {
        res.redirect('/');
      }
    });

  });

  app.listen(3000);

});

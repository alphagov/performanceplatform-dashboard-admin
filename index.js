var express = require('express'),
    config = require('./config'),
    StubRepo = require('./src/stub_repo');

var app = express(),
    repo = StubRepo.fromConfig(config.stub);

repo.open(function() {

  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');

  app.use(express.static('public'));

  app.get('/', function (req, res) {
    res.render('index', { "dashboards": repo.dashboards });
  });

  app.listen(3000);

});


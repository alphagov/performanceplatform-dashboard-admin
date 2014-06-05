var async = require('async'),
    fs = require('fs-extra'),
    path = require('path'),
    util = require('util'),
    glob = require('glob');

var GitRepo = require('./git_repo');

function CollectorRepo(path, remote, query_glob, development) {
  this.path = path;
  this.remote = remote;
  this.query_glob = query_glob;
  this.development = development;
}

util.inherits(CollectorRepo, GitRepo);

CollectorRepo.prototype.reloadMetadata = function(callback) {
  var query_glob = require('path').join(this.path, this.query_glob);

  glob(query_glob, function(err, files) {
    if (err) callback(err);
    else {
      async.map(files, fs.readFile, function(err, content) {
        this.collectors = content.map(function(c) { return c.toString('utf8'); })
                                 .map(JSON.parse);
        callback();
        this.collectorsByDataGroup = this.collectors.reduce(function(m, c) {
          var dataGroup = c['data-set']['data-group'],
              collectors = m[dataGroup];

          if (!collectors) m[dataGroup] = collectors = [ ];

          collectors.push(c);

          return m;
        }, {});
      }.bind(this));
    }
  }.bind(this));
};

CollectorRepo.prototype.save = function (moduleType, dataGroup, dataType, config, callback) {
  var configFilePath = path.join('queries', dataGroup, dataType + '.json'),
      fullConfigFilePath = path.join(this.path, configFilePath);

  if (moduleType !== 'realtime') {
    throw('Saving to the config repo only supports realtime modules at the moment...');
  }

  configJSON = JSON.stringify({
    "data-set": {
      "data-group": dataGroup,
      "data-type": dataType
    },
    "entrypoint": "performanceplatform.collector.ga.realtime",
    "options": {},
    "query": {
      "filters": "ga:pagePath=~/" + config['start-page-slug'],
      "ids": "ga:84779739",
      "metrics": "ga:activeVisitors"
    },
    "token": "ga-realtime"
  }, null, '  ') + "\n";

  var gitActions = [
    fs.outputFile.bind(fs, fullConfigFilePath, configJSON, {'encoding': 'utf8'}),
    this._repo.add.bind(this._repo, [configFilePath]),
    this._repo.commit.bind(this._repo, 'Adding ' + moduleType + ' configuration for ' + dataGroup)
  ];

  if (this.development) {
    console.log('Not pushing config changes while in development.');
  } else {
    gitActions.push(this._repo.push.bind(this._repo, 'origin', 'master', null));
  }

  async.series(gitActions,
    function (err, results) {
      callback(err);
    }
  );

};

CollectorRepo.fromConfig = function(config, development) {
  return new CollectorRepo(
    config.path,
    config.remote,
    config.query_glob,
    development
  );
};

module.exports = CollectorRepo;

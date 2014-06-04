var async = require('async'),
    fs = require('fs-extra'),
    path = require('path'),
    util = require('util');

var GitRepo = require('./git_repo');

function ConfigRepo(path, remote, development) {
  this.path = path;
  this.remote = remote;
  this.development = development;
}

util.inherits(ConfigRepo, GitRepo);

ConfigRepo.prototype.save = function (moduleType, dataGroup, dataType, config, callback) {
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

ConfigRepo.fromConfig = function(config, development) {
  return new ConfigRepo(config.path, config.remote, development);
};

module.exports = ConfigRepo;

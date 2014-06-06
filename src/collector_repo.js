var async = require('async'),
    fs = require('fs-extra'),
    path = require('path'),
    util = require('util'),
    glob = require('glob'),
    _ = require('lodash');

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

CollectorRepo.prototype.saveAll = function(collectors, commitMessage, callback) {

  var actions = collectors.map(function(collector) {
    var dataGroup = collector['data-set']['data-group'],
        dataType = collector['data-set']['data-type'],
        configFilePath = path.join('queries', dataGroup, dataType + '.json'),
        fullConfigFilePath = path.join(this.path, configFilePath);

    return [
      fs.outputFile.bind(fs, fullConfigFilePath,
        JSON.stringify(collector, null, '  ') + '\n', { 'encoding': 'utf8' }),
      this._repo.add.bind(this._repo, [configFilePath])
    ];
  }.bind(this));

  actions.push.apply(actions, [
    this._generateCronJobs.bind(this),
    this._repo.add.bind(this._repo, ['./cronjobs']),
    this.commit.bind(this, commitMessage)
  ]);

  if (this.development) {
    console.log('Not pushing config changes while in development.');
  } else {
    actions.push(this._repo.push.bind(this._repo, 'origin', 'master', null));
  }

  async.series(_.flatten(actions),
    function (err, results) {
      callback(err);
    }
  );

};

CollectorRepo.prototype._generateCronJobs = function(callback) {
  var command = 'cd ' + this.path + ' && python tools/cronjobs.py > cronjobs';

  require('child_process').exec(command, callback);
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

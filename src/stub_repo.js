var async = require('async'),
    gitty = require('gitty'),
    glob = require('glob'),
    fs = require('fs');

function StubRepo(path, remote, json_glob) {
  this.path = path;
  this.remote = remote;
  this.json_glob = json_glob;

  this.dashboards = [];
}

StubRepo.prototype.open = function(callback) {

  var repoOpened = this._repoOpened.bind(this, callback);

  fs.exists(this.path, function(doesExist) {
    if (doesExist) repoOpened(gitty(this.path));
    else gitty.clone(this.path, this.remote, function(err) {
      if (err) console.error(err);
      else repoOpened(gitty(this.path));
    }.bind(this));
  }.bind(this));

};

StubRepo.prototype.update = function(callback) {
  this._repo.pull('origin', 'master', null, function(err) {
    if (err) console.error(err);
    else {
      this._updateDashboardsList(callback);
    }
  }.bind(this));
};

StubRepo.prototype._repoOpened = function(callback, repo) {
  this._repo = repo;
  this.update(callback);
};

StubRepo.prototype._updateDashboardsList = function(callback) {
  var joined_glob = require('path').join(this.path, this.json_glob);

  glob(joined_glob, function(err, files){
    if (err) console.error(err);
    else {
      async.map(files, fs.readFile, function(err, result) {
        this.dashboards = result.map(function(b) {
          return b.toString('utf8');
        }).map(JSON.parse);
        callback();
      }.bind(this));
    }
  }.bind(this));
};



StubRepo.fromConfig = function(config) {
  return new StubRepo(config.path, config.remote, config.json_glob);
};

module.exports = StubRepo;

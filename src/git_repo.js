var fs = require('fs'),
    gitty = require('gitty');

function GitRepo() {
}

GitRepo.prototype.open = function(callback) {
  var repoOpened = this._repoOpened.bind(this, callback);

  fs.exists(this.path, function(doesExist) {
    if (doesExist) repoOpened(gitty(this.path));
    else gitty.clone(this.path, this.remote, function(err) {
      if (err) console.error(err);
      else repoOpened(gitty(this.path));
    }.bind(this));
  }.bind(this));

};

GitRepo.prototype.save = function (callback) {
  throw('Unimplemented');
};

GitRepo.prototype.update = function(callback) {
  this._repo.pull('origin', 'master', null, function (err) {
    if (err) {
      console.error(err);
    } else {
      this.reloadMetadata(callback);
    }
  }.bind(this));
};

GitRepo.prototype.reloadMetadata = function (callback) {
  callback();
};

GitRepo.prototype._repoOpened = function(callback, repo) {
  this._repo = repo;
  this.update(callback);
};

module.exports = GitRepo;

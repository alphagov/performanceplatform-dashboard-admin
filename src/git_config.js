var exec = require('child_process').exec,
    crypto = require('crypto');

function GitConfig () {
}

GitConfig.prototype.getCommitterMetadata = function (callback) {
  var child = exec('git config --get-regexp "user.(name|email)"',
    function (err, stdout, stderr) {
      if (err) {
        console.error('Error while getting git configuration: ' + err);
        return callback(err);
      }

      var md5 = crypto.createHash('md5'),
          config = stdout.trim().split("\n"),
          committer = {};

      for (var i = 0; i < config.length; i++) {
        var matches = config[i].trim().match(/^user\.([a-z]*) (.*)$/);
        committer[matches[1].trim()] = matches[2].trim();
      }

      if (committer.email) {
        md5.update(committer.email.toLowerCase());
        committer.emailHash = md5.digest('hex');
      }

      callback(null, committer);
  });
};

module.exports = GitConfig;


var request = require('request');


function Jenkins(url, job, token, creds) {
  this.url = url;
  this.job = job;
  this.token = token;
  this.creds = creds;
}

Jenkins.prototype.deploy = function(callback) {

  var url = this.url + '/job/' + this.job + '/build';

  var r = request.post(url, {
    auth: this.creds,
    form: {
      token: this.token,
      json: JSON.stringify({
        parameter: [
          { name: 'APPLICATION_VERSION', value: 'master' }
        ]
      })
    }
  }, function(err, response, body) {
    if (err) {
      var errorMessage = 'Error deploying configuration using Jenkins.';
      console.error(errorMessage);
      callback({
        'status': 'error',
        'message': errorMessage
      });
    } else {
      if (response.statusCode < 200 ||
          response.statusCode >= 300) callback(body);
      else {
        callback(null);
      }
    }
  });

};

Jenkins.fromConfig = function(config) {
  return new Jenkins(
    config.url,
    config.job,
    config.token,
    config.creds
  );
};

module.exports = Jenkins;

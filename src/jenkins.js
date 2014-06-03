
var request = require('request');


function Jenkins(url, job, token, creds, development) {
  this.url = url;
  this.job = job;
  this.token = token;
  this.creds = creds;
  this.development = development;
}

Jenkins.prototype.deploy = function(callback) {

  var url = this.url + '/job/' + this.job + '/build';

  if (this.development) callback();
  else {
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
  }

};

Jenkins.fromConfig = function(config, development) {
  return new Jenkins(
    config.url,
    config.job,
    config.token,
    config.creds,
    development
  );
};

module.exports = Jenkins;

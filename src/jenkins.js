
var request = require('request');


function Jenkins(url, token, creds, development) {
  this.url = url;
  this.token = token;
  this.creds = creds;
  this.development = development;
}

Jenkins.prototype.deploy = function(job, params, callback) {

  var url = this.url + '/job/' + job + '/build',
      paramArray = Object.keys(params).map(function(k) {
        return { name: k, value: params[k] };
      });;

  if (this.development) callback();
  else {
    var r = request.post(url, {
      auth: this.creds,
      form: {
        token: this.token,
        json: JSON.stringify({
          parameter: paramArray
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
    config.token,
    config.creds,
    development
  );
};

module.exports = Jenkins;

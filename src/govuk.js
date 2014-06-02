
var request = require('request');


function GovUK() {
}

GovUK.prototype.fromStartPage = function(url, callback) {
  request.get(url + '.json', function(err, response, body) {
    if (err) callback(err);
    else if (response.statusCode < 200 || response.statusCode >= 300) {
      callback('failed with status: ' + response.statusCode);
    } else {
      var json = JSON.parse(body);
      callback(null, {
        title: json.title,
        description: json.details.description,
        relatedPages: {
          transaction: {
            url: url,
            title: json.title
          },
          other: json.related.map(function(link) {
            return {
              url: link.web_url,
              title: link.title
            };
          })
        }
      });
    }
  });
};

GovUK.fromConfig = function(config) {
  return new GovUK(
  );
};

module.exports = GovUK;

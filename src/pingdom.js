var pingdom = require('pingdom'),
    url = require('url');

function Pingdom (pingdomConfig, isDevelopment) {
  this.username = pingdomConfig.username;
  this.password = pingdomConfig.password;
  this.app_key = pingdomConfig.app_key;
  this.isDevelopment = isDevelopment;
}

Pingdom.prototype.createCheck = function (url, govukSlug, callback) {
  var urlBits = this.parseURL(url),
      checkResolution = 5, // Pingdom checks services every 5 minutes
      checkName = 'PP_DASHBOARD_ADMIN_' + govukSlug; // Namespace our checks

  var checkConfig = {
    'name': checkName,
    'host': urlBits.host,
    'type': urlBits.type,
    'resolution': checkResolution,
    'url': urlBits.path,
    'encryption': urlBits.encryption,
    'port': urlBits.port
  };

  if (this.isDevelopment) {
    console.log('Not creating a Pingdom check because development is set to true in your config.');
    console.log('The following check would be created:');
    console.log(checkConfig);
    callback(null);
  } else {
    pingdom.createCheck(
      this.username,
      this.password,
      this.app_key,
      checkConfig,
      function (err) {
        if (err) {
          callback(err);
        } else {
          callback(null);
        }
      }
    );
  }

};

Pingdom.prototype.parseURL = function (checkURL) {
  var parsedURL = url.parse(checkURL),
      type, encryption, port;

  if (parsedURL.search) {
    throw('Query parameters are untested, so we\'re not supporting them yet');
  }

  if (parsedURL.protocol === 'http:') {
    type = 'http';
    encryption = false;
  } else if (parsedURL.protocol === 'https:') {
    type = 'http';
    encryption = true;
  } else {
    throw('URL protocols other than http or https are unsupported');
  }

  if (parsedURL.port) {
    port = parseInt(parsedURL.port);
  } else {
    port = 80;
  }

  return {
    'host': parsedURL.host,
    'type': type,
    'path': parsedURL.pathname,
    'encryption': encryption,
    'port': port
  };
};

Pingdom.fromConfig = function (pingdomConfig, development) {
  return new Pingdom(
    pingdomConfig,
    development
  );
};

module.exports = Pingdom;

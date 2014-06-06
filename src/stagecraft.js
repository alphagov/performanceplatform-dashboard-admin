
var async = require('async'),
    request = require('request'),
    _ = require('lodash');


function Stagecraft(url, creds, tokens, development) {
  this.url = url;
  this.creds = creds;
  this.tokens = tokens;
  this.development = development;
}

Stagecraft.prototype.createDataSetsForCollectors = function(collectors, callback) {
  if (this.development || collectors.length === 0) {
    console.log('no need to talk to stagecraft');
    callback();
  } else {
    var slug = collectors[0]['data-set']['data-group'];

    this.addDataGroup(slug, function(err) {
      if (err && err != Stagecraft.DATA_GROUP_EXISTS) callback(err);
      else {
        async.series([
          this.getDataGroups.bind(this),
          this.getDataTypes.bind(this),
          this.getDataSets.bind(this)
        ],
        function(err, results) {
          if (err) callback(err);
          else {
            var dataGroups = results[0],
                dataTypes = results[1],
                dataSets = results[2],
                dataGroupId = dataGroups.filter(function(dg) {
                  return dg.name === slug;
                })[0].id, actions;

            actions = collectors.map(function(collector) {
              var dataType = collector['data-set']['data-type'],
                  dataTypeId = dataTypes.filter(function(dt) {
                    return dt.name === dataType;
                  })[0].id,
                  token = this.tokens[collector['token']];

              return this.addDataSet.bind(this, token, dataGroupId, dataTypeId)
            }.bind(this));

            if (this.development) {
              console.log("Don't create data sets in development mode");
              callback(); 
            } else {
              async.parallel(actions, callback);
            }
          }
        }.bind(this));
      }
    }.bind(this));
  }
};

Stagecraft.prototype.getDataGroups = function(callback) {
  this._getList('datagroup', callback);
};

Stagecraft.prototype.getDataTypes = function(callback) {
  this._getList('datatype', callback);
};

Stagecraft.prototype.getDataSets = function(callback) {
  this._getList('dataset', callback);
};

Stagecraft.prototype.addDataSet = function(token, dataGroup, dataType, callback) {
  this._authRequest('post', this.url + '/admin/datasets/dataset/add/', {
    'data_group': dataGroup,
    'data_type': dataType,
    'published': '',
    'bearer_token': token,
    'upload_format': '',
    'upload_filters': '',
    'auto_ids': '',
    'queryable': 'on',
    'realtime': 'on',
    'capped_size': 4194304,
    'max_age_expected': 360,
    '_save': 'Save'
  }, function(err, response, body) {
    callback(err);
  });
};

Stagecraft.prototype.deleteDataSet = function(dataSet, callback) {
  this._authRequest('post', this.url + '/admin/datasets/dataset/' + dataSet + '/delete/', {
    post: 'yes'
  }, function(err, response, body) {
    callback(err);
  });
};

Stagecraft.prototype.addDataGroup = function(name, callback) {
  this._authRequest('post', this.url + '/admin/datasets/datagroup/add/', {
    name: name,
    'dataset_set-TOTAL_FORMS': 0,
    'dataset_set-INITIAL_FORMS': 0,
    'dataset_set-MAX_NUM_FORMS': 0,
    'dataset_set-__prefix__-id': '',
    'dataset_set-__prefix__-data_group': '',
    '_save': 'Save'
  }, function(err, response, body) {
    if (err) callback(err);
    else if (/Data group with this Name already exists/.test(body)) {
      callback(Stagecraft.DATA_GROUP_EXISTS);
    }
    else {
      callback(null, 'added');
    }
  });
};

Stagecraft.prototype._getList = function(type, callback) {
  this._authRequest('get', this.url + '/admin/datasets/' + type + '/?all=', {},
      function(err, response, body) {
        if (err) callback(err);
        else {
          var rx = new RegExp('/admin/datasets/' + type + '/([0-9]+)/[^"]*">([^<]+)<', 'g'),
              list = [],
              match;

          while (match = rx.exec(body)) {
            list.push({
              id: parseInt(match[1]),
              name: match[2]
            });
          }

          callback(null, list);
        }
      });
};

Stagecraft.prototype._authRequest = function(method, url, form, callback) {
  function makeRequest(sessionId, token, cookie) {
    var baseForm, opts;

    if (token) baseForm = { csrfmiddlewaretoken: token };

    opts = {
      form: _.merge(baseForm, form),
      headers: {
        'Referer': url,
        'Cookie': 'sessionid=' + sessionId + ';' + 
            (cookie ? (' csrftoken=' + cookie +';') : '')
      },
      followRedirect: false
    };

    console.log('[' + method + '] ' + url);
    console.log(opts);

    request[method](url, opts, callback);
  }

  this._login(function(err, sessionId) {
    if (err) callback(err);
    else if (method === 'get') makeRequest(sessionId);
    else {
      this._getCSRFToken(url, sessionId, function(err, token, cookie) {
        if (err) callback(err);
        else {
          makeRequest(sessionId, token, cookie);
        }
      }.bind(this));
    }
  }.bind(this));
};

Stagecraft.prototype._login = function(callback) {
  var loginUrl = this.url + '/admin/';
  this._getCSRFToken(loginUrl, null, function(err, token, cookie) {
    if (err) callback(err);
    else {
      request.post(loginUrl, {
        form: {
          csrfmiddlewaretoken: token,
          this_is_the_login_form: 1,
          next: "/admin/",
          username: this.creds.user,
          password: this.creds.password
        },
        headers: {
          'Referer': loginUrl,
          'Cookie': 'csrftoken=' + cookie
        },
        followRedirect: false
      }, function(err, response, body) {
        if (err) callback(err);
        else if (response.statusCode !== 302) callback('failed to login: ' + body);
        else {
          callback(null, this._findCookieValue(response.headers, 'sessionid'));
        }
      }.bind(this));
    }
  }.bind(this));
};

Stagecraft.prototype._getCSRFToken = function(url, sessionId, callback) {
  var headers;

  if (sessionId) {
    headers = {
      'Cookie': 'sessionid=' + sessionId
    }
  }

  request.get(url, { headers: headers }, function(err, response, body) {
    if (err) callback(err);
    else {
      var tokenMatch = /name='csrfmiddlewaretoken' value='([^']+)'/.exec(body) ;
          cookie = this._findCookieValue(response.headers, 'csrftoken');
      callback(null, tokenMatch[1], cookie);
    }
  }.bind(this));
};

Stagecraft.prototype._findCookieValue = function(headers, key) {
  return headers['set-cookie'].map(function(cookie) {
    return new RegExp(key + '=([^;]+);').exec(cookie);
  }).filter(function(match) { return !!match; })[0][1];
};


Stagecraft.DATA_GROUP_EXISTS = 'data-group-exists';

Stagecraft.fromConfig = function(config, development) {
  return new Stagecraft(
    config.url,
    config.creds,
    config.tokens,
    development
  );
};

module.exports = Stagecraft;

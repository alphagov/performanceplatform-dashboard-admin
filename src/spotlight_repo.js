var async = require('async'),
    fs = require('fs'),
    glob = require('glob'),
    jsonschema = require('jsonschema'),
    util = require("util"),
    _ = require('lodash');

var GitRepo = require('./git_repo');

function SpotlightRepo(path, remote, json_glob, development) {
  this.path = path;
  this.remote = remote;
  this.json_glob = json_glob;
  this.development = development;

  this.dashboards = [];
}

util.inherits(SpotlightRepo, GitRepo);

SpotlightRepo.prototype.save = function(isNew, dashboard, commitMessage, callback) {
  var repoPath = require('path').join('dashboards', dashboard.slug + '.json'),
      dashboardPath = require('path').join(this.path, repoPath),
      dashboardJSON = JSON.stringify(dashboard, null, '  ') + "\n",
      validationResults = this.validate(dashboard);

  if (validationResults.length > 0) {
    callback('Dashboard failed validation: <pre>' + JSON.stringify(validationResults, null, '  ') + '</pre>');
  } else {
    fs.exists(dashboardPath, function(exists) {

      if (exists && isNew) callback("A dashboard with the slug '" + dashboard.slug + "' already exists");
      else {
        var gitActions = [
          fs.writeFile.bind(fs, dashboardPath, dashboardJSON, {'encoding': 'utf8'}),
          this._repo.add.bind(this._repo, [repoPath]),
          this.commit.bind(this, commitMessage),
          this.updateDashboards.bind(this)
        ];

        if (this.development) {
          console.log('Not pushing config changes while in development.');
        } else {
          gitActions.push(this._repo.push.bind(this._repo, 'origin', 'master', null));
        }

        async.series(
          gitActions,
          function (err, results) {
            callback(err);
          }
        );
      }
    }.bind(this));
  }
};

SpotlightRepo.prototype.selectDashboard = function (slug) {
  return this.dashboards.filter(function (dashboard) {
    return (dashboard.slug === slug);
  })[0];
};

SpotlightRepo.prototype.validate = function(dashboard) {
  var validator = new jsonschema.Validator(),
      schemaDirectory = require('path').join('../', this.path, 'schema'),
      dashboardResult = validator.validate(dashboard,
          require(schemaDirectory + '/dashboard')),
      moduleResults;

  function validateModule(module) {
    var moduleType = module['module-type'],
        moduleSchema, results;

    try { moduleSchema = require(schemaDirectory + '/modules/' + moduleType); }
    catch (e) { moduleSchema = require(schemaDirectory + '/module'); }

    results = validator.validate(module, moduleSchema);

    // need to consider tabs!
    if (moduleType === 'tab') {
      results = [results].concat(module.tabs.map(validateModule));
    }

    return results;
  }

  if (dashboard.modules && dashboard.modules.length > 0) {
    moduleResults = _.flatten(dashboard.modules.map(validateModule));
  } else {
    moduleResults = [];
  }

  moduleResults.unshift(dashboardResult);

  return moduleResults.filter(function(result) {
    return result.errors.length > 0;
  }).map(function(result) {
    return {
      'id': result.instance.slug,
      'errors': result.errors.map(function(e) { return e.stack; })
                             .reduce(function(out, m) {
                               if (out.indexOf(m) < 0) out.push(m);
                               return out;
                             }, [])
    };
  });
};

SpotlightRepo.prototype.reloadMetadata = function (callback) {
  this.updateDashboards(callback);
};

SpotlightRepo.prototype.updateDashboards = function (callback) {
  this._updateDashboardsList(function (err) {
    if (err) {
      callback(err);
    } else {
      this._updateClassifications(callback);
    }
  }.bind(this));
};

SpotlightRepo.prototype._updateDashboardsList = function(callback) {
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

SpotlightRepo.prototype._updateClassifications = function(callback) {
  async.map([
    require('path').join(this.path, 'departments.json'),
    require('path').join(this.path, 'agencies.json'),
    require('path').join(this.path, 'business-models.json'),
    require('path').join(this.path, 'customer-types.json')
  ], fs.readFile,
  function(err, content) {
    if (err) callback(err);
    else {
      var json = content.map(JSON.parse);

      this.departments = Object.keys(json[0]).map(function(id) {
        var obj = json[0][id];
        obj.id = id;
        return obj;
      });
      this.agencies = Object.keys(json[1]).map(function(id) {
        var obj = json[1][id];
        obj.id = id;
        return obj;
      });
      this.businessModels = Object.keys(json[2]).map(function(id) {
        var obj = {
          id: id,
          title: json[2][id]
        };
        return obj;
      });
      this.customerTypes = Object.keys(json[3]).map(function(id) {
        var obj = {
          id: id,
          title: json[3][id]
        };
        return obj;
      });

      callback();
    }
  }.bind(this));
};

SpotlightRepo.fromConfig = function(config, development) {
  return new SpotlightRepo(config.path, config.remote, config.json_glob, development);
};

module.exports = SpotlightRepo;

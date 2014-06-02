var async = require('async'),
    fs = require('fs'),
    gitty = require('gitty'),
    glob = require('glob'),
    jsonschema = require('jsonschema'),
    _ = require('lodash');

function StubRepo(path, remote, json_glob, development) {
  this.path = path;
  this.remote = remote;
  this.json_glob = json_glob;
  this.development = development;

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
      this.updateDashboards(callback);
    }
  }.bind(this));
};

StubRepo.prototype.save = function(isNew, dashboard, commitMessage, callback) {
  var repoPath = require('path').join('dashboards', dashboard.slug + '.json'),
      dashboardPath = require('path').join(this.path, repoPath),
      dashboardJSON = JSON.stringify(dashboard, null, '  ') + "\n";

  fs.exists(dashboardPath, function(exists) {

    if (exists && isNew) callback("A dashboard with the slug '" + dashboard.slug + "' already exists");
    else {
      var gitActions = [
        fs.writeFile.bind(fs, dashboardPath, dashboardJSON, {'encoding': 'utf8'}),
        this._repo.add.bind(this._repo, [repoPath]),
        this._repo.commit.bind(this._repo, commitMessage),
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
};

StubRepo.prototype.selectDashboard = function (slug) {
  return this.dashboards.filter(function (dashboard) {
    return (dashboard.slug === slug);
  })[0];
};

StubRepo.prototype.validate = function(dashboard) {
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

  moduleResults = _.flatten(dashboard.modules.map(validateModule));

  moduleResults.unshift(dashboardResult);

  return moduleResults.filter(function(result) {
    console.log(result)
    return result.errors.length > 0;
  }).map(function(result) {
    return {
      'id': result.instance.slug,
      'errors': result.errors.map(function(e) { return e.stack; })
                             .reduce(function(out, m) {
                               if (out.indexOf(m) < 0) out.push(m);
                               return out;
                             }, [])
    }
  });
};

StubRepo.prototype.updateDashboards = function (callback) {
  this._updateDashboardsList(function (err) {
    if (err) {
      callback(err);
    } else {
      this._updateClassifications(callback);
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

StubRepo.prototype._updateClassifications = function(callback) {
  this.departments = this.dashboards.reduce(function(departments, dashboard) {
    if (dashboard.department &&
        departments.filter(function(d) {
          return d.title === dashboard.department.title;
        }).length === 0) {
      departments.push(dashboard.department);
    }
    return departments
  }, []);
  this.businessModels = this.dashboards.reduce(function(models, dashboard) {
    var model = dashboard['business-model'];
    if (model && models.indexOf(model) < 0) {
      models.push(model);
    }
    return models;
  }, []);
  this.customerTypes = this.dashboards.reduce(function(types, dashboard) {
    var type = dashboard['customer-type'];
    if (type && types.indexOf(type) < 0) {
      types.push(type);
    }
    return types;
  }, []);
  callback();
};



StubRepo.fromConfig = function(config) {
  return new StubRepo(config.path, config.remote, config.json_glob, config.development);
};

module.exports = StubRepo;

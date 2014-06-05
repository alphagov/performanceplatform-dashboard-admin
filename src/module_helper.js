
var mustache = require('mustache'),
    fs = require('fs');

function ModuleHelper(modules, collectorRepo) {
  this.modules = modules;
  this.collectorRepo = collectorRepo;
}

ModuleHelper.prototype.strip = function(existingModules) {

  existingModules = existingModules || [];

  var slugsToRemove = _.flatten(this.modules.map(function(m) {
    return m.built ? m.slugs : [];
  }));

  return existingModules.filter(function(m) {
    return slugsToRemove.indexOf(m.slug) < 0;
  });

};

ModuleHelper.prototype.modified = function(form) {

  return _.flatten(this.modules.map(function(m) {
    var moduleConfig = [];
    if (m.built) {
      moduleConfig = m.templates.map(function(template) {
        var templateContent = fs.readFileSync('./templates/' + template).toString('utf8'),
            rendered = mustache.render(templateContent, { form: form });

        return JSON.parse(rendered);
      });
    }
    return moduleConfig;
  }));

  return newModules.concat(remainingModules);

};

ModuleHelper.prototype.parse = function(dashboard) {
  var collectors = this.collectorRepo.collectorsByDataGroup[dashboard.slug];

  return this.modules.map(function(module) {
    var matched;

    if (dashboard.modules) {
      module.existing = _.flatten(module.slugs.map(function(slug) {
        var matched = dashboard.modules.filter(function(dashboardModule) {
          return dashboardModule.slug === slug;
        });

        return matched;
      }));

      module.enabled = module.existing.length > 0 && module.existing.every(function(m) { return !m.disabled });
    } else {
      module.existing = [ ];
      module.enabled = false;
    }

    if (collectors && module.data_type) {
      matched = collectors.filter(function(c) {
        return c['data-set']['data-type'] === module.data_type;
      });
      if (matched) module.collector = matched[0];
    }

    return module;
  });
};

ModuleHelper.prototype.getTxIdentifier = function(module) {
  return module.existing.length > 0 ? module.existing[0]['query-params']['filter_by'][0].split(':')[1] : '';
};

ModuleHelper.prototype.getRealtimePath = function(module) {
  var path = module.collector && module.collector.query.filters;

  if (path) {
    path = /ga:pagePath=\~\^\/(.+)\$/.exec(path)[1];
  }

  return path;
};

ModuleHelper.prototype.getSlug = function(dashboard) {
  return dashboard.relatedPages.transaction.url.replace('https://www.gov.uk/', '');
};

module.exports = ModuleHelper;


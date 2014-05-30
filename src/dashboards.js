
var typeToTitle = {
  "transaction": "Services",
  "high-volume-transaction": "High Volume Transactions"
};

module.exports = {
  alphabetise: function(dashboards) {
    return dashboards.sort(function(a, b) {
                        if (a.title < b.title) return -1;
                        else if (a.title > b.title) return 1;
                        else return 0;
                      })
                     .reduce(function(out, dashboard) {
                        var firstLetter = dashboard.title.substring(0, 1).toLowerCase();

                        if (!out[firstLetter]) out[firstLetter] = [];

                        out[firstLetter].push(dashboard);
                        return out;
                      }, {});
  },
  splitByType: function(dashboards) {
    return dashboards.reduce(function(out, dashboard) {
      var title = typeToTitle[dashboard['dashboard-type']] || 'Other';
      if (!out[title]) out[title] = [];
      out[title].push(dashboard);
      return out;
    }, {});
  }
};

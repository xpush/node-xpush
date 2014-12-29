define(['settings'], function(Settings) {
  "use strict";

  return new Settings({

    datasources: {
      influxdb: {
        type: 'influxdb',
        url: "http://localhost:8086/db/xpush",
        username: 'xpush_admin_dbuser',
        password: 'password',
      },
      grafana: {
        type: 'influxdb',
        url: "http://localhost:8086/db/grafana",
        username: 'admin',
        password: 'admin',
        grafanaDB: true
      },
    },

    search: {
      max_results: 100
    },

    default_route: '/dashboard/file/default.json',

    unsaved_changes_warning: true,

    playlist_timespan: "1m",

    admin: {
      password: ''
    },

    window_title_prefix: 'Grafana - ',

    plugins: {
      panels: [],
      dependencies: [],
    }

  });
});

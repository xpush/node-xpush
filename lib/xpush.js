var util   = require('util'),
    http   = require('http'),
    events = require('events'),
    argv   = require('optimist').argv;

require('pkginfo')(module, 'version');

var SessionServer = exports.SessionServer = require('./server/session-server').SessionServer,
    ChannelServer = exports.ChannelServer = require('./server/channel-server').ChannelServer;


exports.createChannelServer = function (options) {
  
  var server;

  server = new ChannelServer(options);

  return server;
};


exports.createSessionServer = function (options) {

  var server;  

  server = new SessionServer(options);

  return server;
};

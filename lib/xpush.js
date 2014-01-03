var util = require('util'),
    http = require('http'),
    events = require('events'),
    argv = require('optimist').argv;

require('pkginfo')(module, 'version');

var GatewayServer = exports.GatewayServer = require('./server/gateway-server').GatewayServer,
    ApiServer     = exports.ApiServer     = require('./server/api-server').ApiServer;


exports.createApiServer = function (options) {
  
  var server;

  server = new ApiServer(options);

  return server;
};


exports.createGatewayServer = function (options) {

  var server;  
  //options.port = port;

  server = new GatewayServer(options);

  return server;
};

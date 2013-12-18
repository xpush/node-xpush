var util = require('util'),
    http = require('http'),
    events = require('events');

require('pkginfo')(module, 'version');

var //GatewayServer = exports.GatewayServer = require('./server/gateway-server').GatewayServer,
    ApiServer     = exports.ApiServer     = require('./server/api-server').ApiServer;


exports.createApiServer = function () {
  var args = Array.prototype.slice.call(arguments),
      handlers = [],
      callback,
      options = {},
      handler,
      server,
      port;

  args.forEach(function (arg) {
    arg = Number(arg) || arg;
    switch (typeof arg) {
      case 'number':   port = arg; break;
      case 'object':   options = arg || {}; break;
      case 'function': callback = arg; handlers.push(callback); break;
    };
  });

  if(!port) port = 80;
  options.port = port;

  function validArguments() {

    var conditions = {
      'port': function () {
        return port;
      },
      'options.redis and options.zookeeper': function () {
        return options && (
          (options.zookeeper && options.zookeeper.address) ||
          (options.redis && options.redis.address));
      },
      'or proxy handlers': function () {
        return handlers && handlers.length;
      }
    }

    var missing = Object.keys(conditions).filter(function (name) {
      return !conditions[name]();
    });

    if (missing.length === 3) {
      message = 'Cannot proxy without ' + missing.join(', ');
      return false;
    }

    return true;
  }

  if (!validArguments()) {
    throw new Error(message);
    return;
  }

  server = new ApiServer(options);
 

  return server;
};

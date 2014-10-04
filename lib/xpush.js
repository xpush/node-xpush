/**
 * Represents a xpush.
 * @module xpush
 */

var util   = require('util'),
    http   = require('http'),
    events = require('events'),
    argv   = require('optimist').argv;

//require('pkginfo')(module, 'version');

var SessionServer = exports.SessionServer = require('./server/session-server').SessionServer,
    ChannelServer = exports.ChannelServer = require('./server/channel-server').ChannelServer;


/**
 * Create channel server
 * @name createChannelServer
 * @function createChannelServer
 */
exports.createChannelServer = function (options, cb) {

  var server;
  server = new ChannelServer(options, cb);
  return server;
};

/**
 * Create session server
 * @name createSessionServer
 * @function createSessionServer
 */
exports.createSessionServer = function (options, cb) {

  var server;
  server = new SessionServer(options, cb);
  return server;
};

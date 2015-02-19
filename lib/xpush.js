/**
 * Represents a xpush.
 * @module xpush
 */

var util   = require('util'),
    fs     = require('fs'),
    http   = require('http'),
    events = require('events'),
    argv   = require('optimist').argv;

//require('pkginfo')(module, 'version');

var SessionServer = exports.SessionServer = require('./server/session-server').SessionServer,
    ChannelServer = exports.ChannelServer = require('./server/channel-server').ChannelServer;

var chkInitProcess = function(options){

  var homePath = options.data || options.home || process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'] + '/.xpush';
  options.home = homePath;
  try {
    if (!fs.existsSync(homePath)) fs.mkdirSync(homePath, 0766);
    if (!fs.existsSync(homePath+'/'+(options.upload || 'upload'))) fs.mkdirSync(homePath+'/'+(options.upload || 'upload'), 0766);
  } catch ( e ){
    console.log( 'Error creating xpush directory: ' + e );
  }

  require('../lib/util/logging')({port: options.port, path: homePath});

}


/**
 * Create channel server
 * @name createChannelServer
 * @function createChannelServer
 */
exports.createChannelServer = function (options, cb) {

  chkInitProcess(options);

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

  chkInitProcess(options);

  var server;
  server = new SessionServer(options, cb);
  return server;
};


exports.welcome = function () {
  return [
    "                         _     ",
    "                        | |    ",
    "   __  ___ __  _   _ ___| |__  ",
    "   \\ \\/ / '_ \\| | | / __| '_ \\ ",
    "    >  <| |_) | |_| \\__ \\ | | |",
    "   /_/\\_\\ .__/ \\__,_|___/_| |_|",
    "        | |                    ",
    "        |_|                    ",
    ""
  ].join('\n');
}

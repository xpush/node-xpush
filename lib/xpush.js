'use strict';

var fs = require('fs');
var path = require('path');

var Utils = require('./util/utils');

var VERSION = (function () {

  var data = fs.readFileSync(path.join(__dirname, '../package.json')).toString();
  return JSON.parse(data).version;
})();


var chkInitProcess = function (options) {

  var homePath = options.data || options.home || process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'] + '/.xpush';
  options.home = homePath;
  try {
    if (!fs.existsSync(homePath)) fs.mkdirSync(homePath, parseInt('0766', 8));
    if (!fs.existsSync(homePath + '/' + (options.upload || 'upload'))) fs.mkdirSync(homePath + '/' + (options.upload || 'upload'), parseInt('0766', 8));
  } catch (e) {
    console.log('Error creating xpush directory: ' + e);
  }

  require('../lib/util/logging')({port: options.port, path: homePath});
};

var welcome = function () {

  return [
    "",
    "                         _     ",
    "                        | |    ",
    "   __  ___ __  _   _ ___| |__  ",
    "   \\ \\/ / '_ \\| | | / __| '_ \\ ",
    "    >  <| |_) | |_| \\__ \\ | | |",
    "   /_/\\_\\ .__/ \\__,_|___/_| |_|",
    "        | |                    ",
    "        |_|         V " + VERSION,
    ""
  ].join('\n');
};


/**

 options.server = {}

 certificate  [String] :  If you want to create an HTTPS server, pass in the PEM-encoded certificate and key
 key  [String] :  If you want to create an HTTPS server, pass in the PEM-encoded certificate and key
 formatters  [Object] :  Custom response formatters for res.send()
 log  [Object] :  You can optionally pass in a bunyan instance; not required
 name  [String] :  By default, this will be set in the Server response header, default is restify
 spdy  [Object] :  Any options accepted by node-spdy
 version  [String] :  A default version to set for all routes
 handleUpgrades  [Boolean] :  Hook the upgrade event from the node HTTP server, pushing Connection: Upgrade requests through the regular request handling chain; defaults to false
 httpsServerOptions  [Object] :  Any options accepted by node-https Server. If provided the following restify server options will be ignored: spdy, ca, certificate, key, passphrase, rejectUnauthorized, requestCert and ciphers; however these can all be specified on httpsServerOptions.

 - http://restify.com/#creating-a-server
 - https://github.com/restify/node-restify/blob/master/lib/server.js

 **/

// SESSION SERVER
function createSessionServer(options) {

  chkInitProcess(options);

  var restify = require('restify');

  var optionsServer = options.server || {};

  if (!optionsServer.name) optionsServer.name = 'xpush';

  var host = options.host = options.host || Utils.getIP();
  var port = options.port || 8080;

  var server = restify.createServer(optionsServer);

  server.use(restify.CORS());

  require('./xpush-session-server.js').init(server, options, function (err, result) {

    if (err) {
      console.error(err, result);
    } else {
      server.listen(port, function () {
        console.log(welcome(), '"SESSION server" listening at ' + host + ":" + port);
      });
    }


  });

  return (server);
}

// CHANNEL SERVER
function createChannelServer(options) {

  chkInitProcess(options);

  var restify = require('restify');
  var socketio = require('socket.io');


  var optionsServer = options.server || {};

  if (!optionsServer.name) optionsServer.name = 'xpush';

  var host = options.host = options.host || Utils.getIP();
  var port = options.port || 8080;

  var server = restify.createServer(optionsServer);
  var io = socketio.listen(server.server);

  server.use(restify.CORS());

  require('./xpush-channel-server.js').init(server, io, options, function (err, result) {

    if (err) {
      console.error(err, result);
    } else {
      server.listen(port, function () {
        console.log(welcome(), '"CHANNEL server" listening at ' + host + ":" + port);
      });
    }

  });

  return (server);
}

module.exports.createSessionServer = createSessionServer;
module.exports.createChannelServer = createChannelServer;

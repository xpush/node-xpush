'use strict';

var fs = require('fs');
var path = require('path');

var Utils = require('./util/utils');

var VERSION = (function () {
  var data = fs.readFileSync(path.join(__dirname, '../package.json')).toString();
  return JSON.parse(data).version;
})();

var chkInitProcess = function (options) {

  var homePath = Utils.getHomePath(options);
  options.home = homePath;
  try {
    if (!fs.existsSync(homePath)) fs.mkdirSync(homePath, parseInt('0766', 8));
    if (!fs.existsSync(homePath + '/' + (options.upload || 'upload'))) fs.mkdirSync(homePath + '/' + (options.upload || 'upload'), parseInt('0766', 8));
  } catch (e) {
    console.log('Error creating xpush directory: ' + e);
  }

  require('../lib/util/logging')({type: options.type, port: options.port, path: homePath});
};

var welcome = function (options) {

  if(options && options.logo) {
    return options.logo;
  } else {
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
  }

};

var host = Utils.getIP();
var port = 8080;

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }
  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

// SESSION SERVER
function createSessionServer(options, cb, server) {

  host = options.host || host;
  port = options.port || port;
  options['type'] = 'SESSION';

  chkInitProcess(options);

  // default RESTIFY server (http://restify.com/)
  if (server === undefined) {

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


    var restify = require('restify');
    var optionsServer = options.server || {};
    if (!optionsServer.name) optionsServer.name = 'xpush';

    var server = restify.createServer(optionsServer);

    restify.CORS.ALLOW_HEADERS.push('authorization');
    restify.CORS.ALLOW_HEADERS.push('accept');
    restify.CORS.ALLOW_HEADERS.push('sid');
    restify.CORS.ALLOW_HEADERS.push('lang');
    restify.CORS.ALLOW_HEADERS.push('origin');
    restify.CORS.ALLOW_HEADERS.push('withcredentials');
    restify.CORS.ALLOW_HEADERS.push('x-requested-with');

    server.use(restify.CORS({
        origins: ["*"],
        headers: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"]
    }));

    server.opts(/.*/, function (req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Methods", req.header("Access-Control-Request-Method"));
        res.header("Access-Control-Allow-Headers", req.header("Access-Control-Request-Headers"));
        res.send(200);
        return next();
    });

    var uploadPath = path.join(
      options.home,
      options.upload || 'upload'
    );

    server.use(restify.fullResponse())
    server.use(restify.jsonp());
    server.use(restify.bodyParser({
        mapParams: true,
        uploadDir: uploadPath,
        mapFiles: true,
        keepExtensions: true
    }));

    server.on('error', onError);
    console.log('default server type : RESTIFY ');

  }

  var sessionServer = require('./xpush-session-server.js');
  sessionServer.init(server, options, function (err, result) {

    if (err) {
      console.error(err, result);
      if(cb) cb(err, result);
    } else {
      server.listen(port, function () {

        console.log(welcome(options), '"SESSION server" listening at ' + host + ":" + port);

        sessionServer.emit("started", host, port)

        if(cb) cb(err, { "host": host, "port": port });

      });
    }

  });

  return (sessionServer);
}

// CHANNEL SERVER
function createChannelServer(options, cb) {

  host = options.host = options.host || Utils.getIP();
  port = options.port || 8080;
  options['type'] = 'CHANNEL';

  chkInitProcess(options);

  var restify = require('restify');
  var socketio = require('socket.io');

  var serverOption = options.server || {};

  if (!serverOption.name) serverOption.name = 'xpush';

  if (options.httpsServerOptions) {
    serverOption.httpsServerOptions = options.httpsServerOptions;
    options.protocol = 'https';
  } else {
    options.protocol = 'http';
  }

  var server = restify.createServer(serverOption);

  var io = socketio.listen(server.server);

  server.use(restify.CORS());
  server.on('error', onError);

  var channelServer = require('./xpush-channel-server.js');
  channelServer.init(server, io, options, function (err, result) {

    if (err) {
      console.error(err, result);
      if(cb) cb(err, result);
    } else {
      server.listen(port, function () {

        console.log(welcome(options), '"CHANNEL server" listening at ' + host + ":" + port);

        channelServer.emit("started", host, port);

        if(cb) cb(err, { "host": host, "port": port });

      });
    }

  });
  return (channelServer);
}

/** Main XPUSH Server **/
module.exports.createSessionServer = createSessionServer;
module.exports.createChannelServer = createChannelServer;


/** Additional Manager (optional, only for specific cases) **/
module.exports.createZookeeperClient = function (options) {

  var zookeeper = require('node-zookeeper-client');
  var addr = 'localhost:2181';
  if (options.zookeeper) {
    if (typeof options.zookeeper === 'string' || options.zookeeper instanceof String) {
      addr = options.zookeeper;
    } else {
      if (options.zookeeper.address)  addr = options.zookeeper.address;
    }
  }
  var zkClient = zookeeper.createClient(addr, {retries: 2});

  return zkClient;

};
module.exports.createRedisManager = function (options) {

  var conf = {
    redis: options.redis
  };

  var RedisManager = require('./session-manager/redis-manager');
  return new RedisManager(conf);

};

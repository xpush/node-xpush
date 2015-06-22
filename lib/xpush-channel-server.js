var EventEmitter = require('events').EventEmitter;
var util = require('util');
var async = require('async');
var shortId = require('shortid');

var Utils = require('./util/utils');
var NodeManager = require('./node-manager/node-manager.js').NodeManager;
var SessionManager = require('./session-manager/session-manager.js').SessionManager;
var SessionSubscriber = require('./session-manager/session-subscriber.js').SessionSubscriber;

function SessionServer() {

  if (!(this instanceof SessionServer)) return new SessionServer();

  EventEmitter.call(this);

}

util.inherits(SessionServer, EventEmitter);

SessionServer.prototype.init = function (server, io, options, cb) {

  this.conf = {
    host: options.host,
    port: options.port,
    weight: options.weight,
    zookeeper: options.zookeeper,
    mongodb: options.mongodb,
    redis: options.redis
  };

  var self = this;

  try {

    async.parallel(
      [ // ASYNC ARRAY (START)

        function (callback) { // # 1

          self.nodeManager = new NodeManager(
            self.conf && self.conf.zookeeper && self.conf.zookeeper.address ? self.conf.zookeeper.address : '',
            true,
            function (err, message) {
              if (!err) {
                console.info(' (init) ZOOKEEPER is connected');
                self.nodeManager.addServerNode(self.conf.host, self.conf.port, self.conf.weight, function (err, path) {
                  if (!err) console.info('        ZOOKEEPER /' + self.conf.host + ':' + self.conf.port);

                  var serverName = path.substring(path.lastIndexOf('/') + 1, path.length);
                  self.serverName = serverName.split('^')[0];

                  callback(err);
                });
              } else {
                callback(err, message);
              }
            }
          );

        },

        function (callback) { // # 2

          self.sessionManager = new SessionManager(
            self.conf && self.conf.redis ? self.conf.redis : undefined,
            function (err, message) {
              console.info(' (init) REDIS     is connected');
              callback(err, message);
            }
          );

        }

      ], // ASYNC ARRAY (END)

      function (err, results) {

        if (!err) {

          self.sessionSubscriber = new SessionSubscriber(
            self.conf && self.conf.redis && self.conf.redis ? self.conf.redis : undefined,
            self.serverName,
            function (err) {
              if (!err) {

                console.info(' (init) REDIS     is connected');
                console.info('        REDIS     is subscribed (' + self.serverName + ')');

                self._startup(server, io);

                if (cb) cb();

              } else {
                console.error(err);
                process.exit(1);
              }
            }
          );

        } else {

          for (var errNum in results) {
            if (results.hasOwnProperty(errNum) && results[errNum]) {
              console.error('  - ' + results[errNum] + '\n');
            }
          }
          process.exit(1);
        }
      }
    );
  } catch (err) {
    console.error('Channel server startup ERROR : ' + err);
  }
};


SessionServer.prototype._startup = function (server, io) {

  server.get('/status/ping', function (req, res, next) {
    res.send({
      status: 'ok',
      result: {
        message: 'pong'
      }
    });

    next();
  });

  io.of('/channel').use(function (socket, next) {
    if (socket.request.headers.cookie) return next();
    next(new Error('Authentication error'));
  }).on('connection', function (socket) {

  });


};

SessionServer.prototype.generateId = function () {
  return shortId.generate();
};

// exports
exports = module.exports = new SessionServer();
exports.SessionServer = SessionServer;

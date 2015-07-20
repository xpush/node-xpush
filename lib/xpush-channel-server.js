var EventEmitter = require('events').EventEmitter;
var util = require('util');
var async = require('async');
var shortId = require('shortid');

var Utils = require('./util/utils');
var NodeManager = require('./node-manager/node-manager.js').NodeManager;
var SessionManager = require('./session-manager/session-manager.js').SessionManager;
var SessionSubscriber = require('./session-manager/session-subscriber.js').SessionSubscriber;


var LIMIT_COUNT = 400;
var BUFFER_COUNT = 25;
var MIN_REPLICAS = 0;

function ChannelServer() {

  if (!(this instanceof ChannelServer)) return new ChannelServer();

  // inner storage for channels
  this.channels = {}; // {U, D, N}
  this.multiChannels = {};

  this.methods = {
    //  SESSION_SOCKET: {},
    CHANNEL_SOCKET: {}
  };


  EventEmitter.call(this);

}

util.inherits(ChannelServer, EventEmitter);

ChannelServer.prototype.init = function (server, io, options, cb) {

  this.conf = {
    host: options.host,
    port: options.port,
    weight: options.weight,
    zookeeper: options.zookeeper,
    mongodb: options.mongodb,
    redis: options.redis
  };

  this.options = this.conf;

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
                self.nodeManager.addServerNode(self.conf.host, self.conf.port, self.conf.weight, function (err, path, replicas) {
                  if (!err) console.info('        ZOOKEEPER /' + self.conf.host + ':' + self.conf.port);

                  var serverName = path.substring(path.lastIndexOf('/') + 1, path.length);
                  self.serverNodePath = path;
                  self.serverName = serverName.split('^')[0];

                  if( replicas ){
                    self.startReplicas = replicas;
                    self.replicas = replicas;
                  } else {
                    self.startReplicas = 160;
                    self.replicas = 160;
                  }

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
              if (!err) {
                console.info(' (init) REDIS     is connected');
              }
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


ChannelServer.prototype._startup = function (server, io) {

  this.io = io;

  var self = this;

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

      var handshakeData = socket.request;

      // TODO
      // Check the channel is available (Existed? ) ?
      // or this is wasted ?
      var _app = handshakeData._query.A;
      var _channel = handshakeData._query.C;
      var _server = handshakeData._query.S;
      var _userId = handshakeData._query.U;
      var _deviceId = handshakeData._query.D || 'N';
      //var _data      = handshakeData._query.DT;


      if (!_app || !_channel || !_server) {
        next('Parameter is not corrected. (A, C, S) ', false);
        return;
      }

      var _us = self.channels[_app + '^' + _channel];

      if (!_us) {
        self.channels[_app + '^' + _channel] = [{
          U: _userId,
          D: _deviceId
        }];
      } else {
        var _u = _us.filter(function (_uu) {
          return (_uu.U == _userId);
        });

        if (_u.length === 0) {
          self.channels[_app + '^' + _channel].push({
            U: _userId,
            D: _deviceId
          });
        }

        next(null, true);

      }
    }
  ).on('connection', function (socket) {

      var _room = socket.handshake.query.A + '^' + socket.handshake.query.C;
      console.log('channel socket connection : ' + socket.id + ' / ' + _room);

      socket.join(_room);

      // DT
      var err = Utils.validJsonParams(socket.handshake.query, ['DT']);
      if (err) {
        socket.emit("connect_error", err);
        socket.disconnect();
        return;
      }

      socket._userId = socket.handshake.query.U;
      socket._deviceId = socket.handshake.query.D;

      var _count_of_this_channel = Object.keys(socket.adapter.rooms[_room]).length;

      // sessionManager의 channel 정보를 update한다.
      self.sessionManager.update(
        socket.handshake.query.A,
        socket.handshake.query.C,
        socket.handshake.query.S,
        _count_of_this_channel);


      if (_count_of_this_channel == 1) {

        console.log('_count_of_this_channel : ', _count_of_this_channel);

        self.sessionManager.retrieve(socket.handshake.query.A, socket.handshake.query.C, function (res) {

          if (res) {
            for (var key in res) {
              console.log(key, socket.handshake.query.S, (key != socket.handshake.query.S));
              if (key != socket.handshake.query.S) {

                console.log(socket.handshake.query.S + ' --> ' + key);
                self.sessionManager.publish(key, {
                  _type: 'add-channel-server',
                  A: socket.handshake.query.A,
                  C: socket.handshake.query.C,
                  S: socket.handshake.query.S
                });

                if (self.channels[_room]) {
                  if (!self.multiChannels[_room]) {
                    self.multiChannels[_room] = [key];
                  } else {
                    if (self.multiChannels[_room].indexOf(key) == -1) self.multiChannels[_room].push(key);
                  }
                }

              }
            }
          }

        });

      }

      // Over
      if( !self.isNodeChanging && Object.keys(self.io.of('/channel').connected).length >= ( LIMIT_COUNT + BUFFER_COUNT ) && MIN_REPLICAS != self.startReplicas != self.replicas ){
    self._changeReplicas( self.startReplicas );
  }

  // channel 내에 아무도 없으면 local cache에서 channel을 삭제함.
  if (_count_of_this_channel == 0) {

    delete self.channels[_a + '^' + _c];

    var _m = self.multiChannels[_a + '^' + _c];
    if (_m) {

      var _ml = _m.length;
      for (var i = 0; i < _ml; i++) {
        self.sessionManager.publish(_m[i], {
          _type: 'del-channel-server',
          A: _a,
          C: _c,
          S: _s,
          NM: '_event',
          DT: _data
        });
      }
      delete self.multiChannels[_a + '^' + _c];
    }

  } else {

    var _m = self.multiChannels[_a + '^' + _c];
    if (_m) {

      var _ml = _m.length;

      for (var i = 0; i < _ml; i++) {

        self.sessionManager.publish(_m[i], {
          _type: 'send-once',
          A: _a,
          C: _c,
          NM: '_event',
          DT: _data
        });
      }

    }

    socket.broadcast.to(_room).emit('_event', {
      event: 'DISCONNECT',
      count: _count_of_this_channel,
      A: _a,
      C: _c,
      U: _u
    });
  }

  // sessionManager의 channel 정보를 update한다.
  self.sessionManager.update(_a, _c, socket.handshake.query.S, _count_of_this_channel);
  self.sessionManager.deleteClient(_a, _c, socket.handshake.query.U);

  self.emit('channel', { // @todo is it using ? channel is must be '_event'
    'event': 'update',
    'count': _count_of_this_channel,
    'A': _a,
    'C': _c,
    'S': socket.handshake.query.S
  });
};

// exports
exports = module.exports = new ChannelServer();
exports.ChannelServer = ChannelServer;

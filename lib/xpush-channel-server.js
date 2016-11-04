var EventEmitter = require('events').EventEmitter;
var util = require('util');
var async = require('async');
var shortId = require('shortid');

var Utils = require('./util/utils');
var NodeManager = require('./node-manager/node-manager.js').NodeManager;
var SessionManager = require('./session-manager/session-manager.js').SessionManager;
var SessionSubscriber = require('./session-manager/session-subscriber.js').SessionSubscriber;
var usage = require('./util/ps')();

var NAMESPACE = '/channel';

function ChannelServer() {

  if (!(this instanceof ChannelServer)) return new ChannelServer();

  // inner storage for channels
  this.channels = {}; // {U, D, N}
  this.multiChannels = {};

  this.methods = {
    CHANNEL_SOCKET: {}
  };

  EventEmitter.call(this);

}

util.inherits(ChannelServer, EventEmitter);

ChannelServer.prototype.init = function(server, io, options, cb) {

  this.server = server;

  this.conf = {
    host: options.host,
    port: options.port,
    weight: options.weight,
    zookeeper: options.zookeeper,
    redis: options.redis
  };

  this.conf.balancing = {
    SCALE: 60, // 단계별 Connection 수
    BUFFER_COUNT: 10, // replica 수정에 대한 인계치 버퍼
    MAX_LEVEL: 4, // scale 배수
    REPLICA_BASE_NUMBER: 4 //
  };

  this.options = this.conf;

  var self = this;

  try {

    async.parallel(
      [ // ASYNC ARRAY (START)
        function(callback) { // # 1

          var startReplicas = Math.pow(Number(self.conf.balancing['REPLICA_BASE_NUMBER']), Number(self.conf.balancing['MAX_LEVEL']));

          var address = '';
          if (self.conf.zookeeper) {
            if (typeof self.conf.zookeeper === 'string' || self.conf.zookeeper instanceof String) {
              address = self.conf.zookeeper;
            } else {
              if (self.conf.zookeeper.address) address = self.conf.zookeeper.address;
            }
          }

          self.nodeManager = new NodeManager(
            address,
            false,
            function(err, message) {
              if (!err) {
                console.info(' (init) ZOOKEEPER is connected');
                self.nodeManager.addServerNode(self.conf.host, self.conf.port, startReplicas, function(err, path, replicas) {

                  //if (!err) console.info('        ZOOKEEPER /' + self.conf.host + ':' + self.conf.port);

                  var serverName = path.substring(path.lastIndexOf('/') + 1, path.length);
                  self.serverNodePath = path;

                  self.serverName = serverName.split('^')[0];

                  if (replicas) {
                    self.replicas = replicas;
                  } else {
                    self.replicas = startReplicas;
                  }

                  // init balacing config
                  self.nodeManager.getConfigInfo('balancing', function(data) {
                    if (data) {

                      self.conf.balancing = data;
                      var configReplica = Math.pow(Number(self.conf.balancing['REPLICA_BASE_NUMBER']), Number(self.conf.balancing['MAX_LEVEL']));

                      if (self.replicas != configReplica) {
                        self._changeReplicas(configReplica);
                      }
                    }
                  });

                  callback(err);
                });
              } else {
                callback(err, message);
              }
            }
          );
        },

        function(callback) { // # 2

          self.sessionManager = new SessionManager(
            self.conf && self.conf.redis ? self.conf.redis : undefined,
            function(err, message) {
              if (!err) {
                console.info(' (init) REDIS     is connected  (for session data)');
              }
              callback(err, message);
            }
          );

        }

      ], // ASYNC ARRAY (END)

      function(err, results) {

        if (!err) {

          self.sessionSubscriber = new SessionSubscriber(
            self.conf && self.conf.redis && self.conf.redis ? self.conf.redis : undefined,
            self.serverName,
            function(err) {
              if (!err) {

                console.info(' (init) REDIS     is connected  (for pub/sub)');
                console.info('        REDIS     is subscribed (C-' + self.serverName + ')');

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


ChannelServer.prototype._startup = function(server, io) {

  this.io = io;

  var self = this;

  server.get('/status/ping', function(req, res, next) {
    res.send({
      status: 'ok',
      result: {
        message: 'pong'
      }
    });

    next();
  });

  /*************************************************************************
   * CHANNEL SOCKET
   *************************************************************************/
  this.io.of(NAMESPACE).use(function(socket, next) {
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
      console.error('Parameter is not corrected. (A, C, S) : ', _app, _channel, _server);
      next('Parameter is not corrected. (A, C, S) ', false);
      return;
    }

    var _us = self.channels[_app + '^' + _channel];

    //console.log(_app + '^' + _channel + ' : _us : ' + _us);

    if (!_us) {
      self.channels[_app + '^' + _channel] = [{
        U: _userId,
        D: _deviceId
      }];
    } else {
      var _u = _us.filter(function(_uu) {
        return (_uu.U == _userId);
      });

      if (_u.length === 0) {
        self.channels[_app + '^' + _channel].push({
          U: _userId,
          D: _deviceId
        });
      }
    }

    socket.handshake.query = {
      A: handshakeData._query.A,
      C: handshakeData._query.C,
      S: handshakeData._query.S,
      U: handshakeData._query.U,
      D: handshakeData._query.D || 'N'
    };

    next(null, true);
  }).on('connection', function(socket) {

    var _room = socket.handshake.query.A + '^' + socket.handshake.query.C;
    //console.log('channel socket connection : ' + socket.id + ' / ' + _room);

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

    var _count_of_this_channel = socket.adapter.rooms[_room].length;

    // sessionManager의 channel 정보를 update한다.
    self.sessionManager.updateConnectedNode(
      socket.handshake.query.A,
      socket.handshake.query.C,
      socket.handshake.query.S,
      _count_of_this_channel);

    if (_count_of_this_channel == 1) {

      //console.log('_count_of_this_channel : ', _count_of_this_channel);

      self.sessionManager.retrieveConnectedNode(socket.handshake.query.A, socket.handshake.query.C, function(res) {

        if (res) {
          for (var key in res) {
            //console.log(key, socket.handshake.query.S, (key != socket.handshake.query.S));
            if (key != socket.handshake.query.S) {

              //console.log(socket.handshake.query.S + ' --> ' + key);
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

    var connectionCount = Object.keys(self.io.of(NAMESPACE).connected).length;
    var currentLevel = Math.floor(connectionCount / Number(self.conf.balancing['SCALE']));
    var stage = Number(self.conf.balancing['MAX_LEVEL']) - currentLevel;
    if (stage < 0) stage = 0;

    var nextReplicas = Math.pow(Number(self.conf.balancing['REPLICA_BASE_NUMBER']), stage);

    /**
     console.log( "connectionCount " + connectionCount );
     console.log( "currentLevel : " + currentLevel );
     console.log( "nextReplicas : " + nextReplicas );
     */

    // Over
    if (!self.isNodeChanging &&
      nextReplicas != self.replicas &&
      connectionCount >= (Number(self.conf.balancing['SCALE'] * currentLevel) + Number(self.conf.balancing['BUFFER_COUNT']))) {
      self._changeReplicas(nextReplicas);
    }

    var _msgObj = {
      event: 'CONNECTION',
      id: socket.id,
      count: _count_of_this_channel,
      A: socket.handshake.query.A,
      C: socket.handshake.query.C,
      S: socket.handshake.query.S,
      U: socket.handshake.query.U,
      D: socket.handshake.query.D
    };

    self.emit('channel', _msgObj);

    if (self.methods.CHANNEL_SOCKET.hasOwnProperty('connection')) self.methods.CHANNEL_SOCKET.connection(_msgObj);

    // 동일한 socket을 사용 중인 user에게 `CONNNECTION` EVENT를 발생시킨다.
    socket.broadcast.to(_room).emit('_event', _msgObj);
    socket.emit('_event', _msgObj);


    for (var key in self.methods.CHANNEL_SOCKET) {
      if (key != 'connection' && key != 'send') {
        socket.on(key, self.methods.CHANNEL_SOCKET[key]);
      }
    }

    socket.on('send', function(params, callback) {

      if (self.methods.CHANNEL_SOCKET.hasOwnProperty('send')) self.methods.CHANNEL_SOCKET.send(params, socket);

      var err = Utils.validSocketParams(params, ['NM', 'DT']);
      if (err) {
        if (callback) callback({
          status: 'ERR-PARAM',
          message: err
        });
        return;
      }

      // socket Id가 존재하면 현재 server에서 전송한다.
      if (params.SS) {

        self._sendPrivate(
          params.S, // server name
          params.SS, // socketId
          params.NM,
          params.DT,
          NAMESPACE);

      } else {

        self._send(
          socket.handshake.query.A,
          socket.handshake.query.C,
          params.NM,
          params.DT,
          NAMESPACE);
      }

    });

    // DISCONNECT
    socket.on('disconnect', function() {
      self._channel_disconnect(socket);
    });

  });

  /*************************************************************************
   * ADMIN SOCKET
   *************************************************************************/

  this.io.of('/admin').use(function(socket, callback) {

    if (self.options.admin && self.options.admin.token) {
      var handshakeData = socket.request;
      if (handshakeData._query.token == self.options.admin.token) {
        callback(null, true);
      } else {
        callback('unauthorized access blocked', false);
      }
    } else {
      callback(null, true);
    }

  }).on('connection', function(socket) {

    var _default = {
      pid: process.pid
    };

    socket.on('info', function(callback) {
      var result = _default;

      result.arch = process.arch;
      result.platform = process.platform;
      result.server = {
        name: self.serverName,
        host: self.options.host,
        port: self.options.port
      };

      callback(result);
    });

    socket.on('usage', function(callback) {
      var result = _default;

      result.name = self.serverName;
      result.host = self.options.host;
      result.uptime = process.uptime();
      result.port = self.options.port;
      result.memory = process.memoryUsage();
      // rss: Resident set size
      // heapTotal: Heap size sampled immediately after a full garbage collection,
      // heapUsed: Current heap size

      var beforeCpu = 0;
      usage.lookup(process.pid, {}, function(err, stat) {

        result.client = {
          socket: Object.keys(self.io.of(NAMESPACE).connected).length,
          channel: Object.keys(self.channels).length,
          bigchannel: Object.keys(self.multiChannels).length,
        };

        if (!err) {
          result.cpu = stat.cpu;
          beforeCpu = stat.cpu;
        } else {
          result.cpu = beforeCpu;
        }

        callback(result);
      });
    });

  });

  this.sessionSubscriber.on('_message', function(receivedData) {

    if (receivedData._type == 'send-once') {

      if (receivedData.SS) {
        self._sendPrivate(null, receivedData.SS, receivedData.NM, receivedData.DT, receivedData.NSP);
      } else {
        self._sendOnce(receivedData.A, receivedData.C, receivedData.NM, receivedData.DT, receivedData.NSP);
      }

    } else if (receivedData._type == 'add-channel-server') {

      if (self.channels[receivedData.A + '^' + receivedData.C]) {

        var _mc = self.multiChannels[receivedData.A + '^' + receivedData.C];

        if (!_mc) {
          self.multiChannels[receivedData.A + '^' + receivedData.C] = [receivedData.S];
        } else {
          if (_mc.indexOf(receivedData.S) == -1) self.multiChannels[receivedData.A + '^' + receivedData.C].push(receivedData.S);
        }
      }

    } else if (receivedData._type == 'del-channel-server') {

      var _mcd = self.multiChannels[receivedData.A + '^' + receivedData.C];
      if (_mcd) {
        self.multiChannels[receivedData.A + '^' + receivedData.C].splice(_mcd.indexOf(receivedData.S), 1);
        if (_mcd.length == 0) delete self.multiChannels[receivedData.A + '^' + receivedData.C];
      }

      if (receivedData.NM && receivedData.DT) {
        self._sendOnce(receivedData.A, receivedData.C, receivedData.NM, receivedData.DT, receivedData.NSP);
      }
    }

    self.emit('subscribe', receivedData);

  });
};

ChannelServer.prototype._changeReplicas = function(replicas) {
  var self = this;
  self.isNodeChanging = true;
  self.nodeManager.setNodeData(self.serverNodePath, replicas, function(err, path, data) {
    self.isNodeChanging = false;
    if (!err) {
      self.replicas = data;
    }
  });
};

ChannelServer.prototype.generateId = function() {
  return shortId.generate();
};

ChannelServer.prototype._send = function(_app, _channel, _name, _data, _namespace) {
  var self = this;
  self._sendOnce(_app, _channel, _name, _data, _namespace);

  var _room = _app + '^' + _channel;

  var _m = self.multiChannels[_room];
  if (_m) {
    var _ml = _m.length;
    for (var i = 0; i < _ml; i++) {

      self.sessionManager.publish(_m[i], {
        _type: 'send-once',
        A: _app,
        C: _channel,
        NM: _name,
        DT: _data,
        NSP: _namespace
      });

    }
  }

};

ChannelServer.prototype._sendPrivate = function(_server, _socketId, _name, _data, _namespace) {

  if (_server) {

    self.sessionManager.publish(_server, {
      _type: 'send-once',
      SS: _socketId,
      NM: _name,
      DT: _data,
      NSP: _namespace
    });

  } else {
    if(!_namespace) _namespace = NAMESPACE;
    var _socket = this.io.of(_namespace).connected[_socketId];
    if (_socket && _socket.id != undefined) {
      var currentTimestamp = Date.now();
      _data.TS = currentTimestamp;
      _socket.emit(_name, _data);
    }
  }

};

ChannelServer.prototype._sendOnce = function(_app, _channel, _name, _data, _namespace) {

  var _room = _app + '^' + _channel;
  var currentTimestamp = Date.now();
  if(!_namespace) _namespace = NAMESPACE;
  if (this.io.of(_namespace).in(_room) != undefined) {
    _data.C = _channel;
    _data.TS = currentTimestamp;
    this.io.of(_namespace).in(_room).emit(_name, _data);

    this.emit('message', {
      A: _app,
      C: _channel,
      TS: currentTimestamp,
      NM: _name,
      DT: _data
    });

  }
};

ChannelServer.prototype._channel_disconnect = function(_this) {

  var socket = _this;

  var self = this;

  var _a = socket.handshake.query.A;
  var _c = socket.handshake.query.C;
  var _u = socket.handshake.query.U;
  var _s = socket.handshake.query.S;

  var _room = _a + '^' + _c;

  socket.leave(_room);

  var _count_of_this_channel = 0;
  if (socket.adapter.rooms[_room]) {
    _count_of_this_channel = socket.adapter.rooms[_room].length;
  }

  // DISCONNECT Data
  var _data = {
    event: 'DISCONNECT',
    count: _count_of_this_channel,
    A: _a,
    C: _c,
    U: _u
  };

  var connectionCount = Object.keys(self.io.of(NAMESPACE).connected).length;
  var currentLevel = Math.floor(connectionCount / Number(self.conf.balancing['SCALE']));
  var stage = Number(self.conf.balancing['MAX_LEVEL']) - currentLevel;
  if (stage < 0) stage = 0;

  var nextReplicas = Math.pow(Number(self.conf.balancing['REPLICA_BASE_NUMBER']), stage);

  /**
   console.log( "connectionCount " + connectionCount );
   console.log( "currentLevel : " + currentLevel );
   console.log( "nextReplicas : " + nextReplicas );
   */

  // Under
  if (!self.isNodeChanging &&
    nextReplicas != self.replicas &&
    connectionCount <= (Number(self.conf.balancing['SCALE'] * Number(currentLevel + 1)) - Number(self.conf.balancing['BUFFER_COUNT']))) {
    self._changeReplicas(nextReplicas);
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
  self.sessionManager.updateConnectedNode(_a, _c, socket.handshake.query.S, _count_of_this_channel);

  self.emit('channel', {
    'event': 'disconnect',
    'count': _count_of_this_channel,
    'option': socket.handshake.query.option,
    'A': _a,
    'C': _c,
    'S': socket.handshake.query.S,
    'U': socket.handshake.query.U,
    'D': socket.handshake.query.D
  });

  if (self.methods.CHANNEL_SOCKET.hasOwnProperty('disconnect')) self.methods.CHANNEL_SOCKET.disconnect(_data);

};


ChannelServer.prototype.channel_on = function(_event, _fn) {
  this.methods.CHANNEL_SOCKET[_event] = _fn;
};

ChannelServer.prototype.onSend = function(_fn) {
  this.methods.CHANNEL_SOCKET['send'] = _fn;
};

ChannelServer.prototype.onDisconnect = function(_fn) {
  this.methods.CHANNEL_SOCKET['disconnect'] = _fn;
};

ChannelServer.prototype.onConnection = function(_fn) {
  this.methods.CHANNEL_SOCKET['connection'] = _fn;
};

ChannelServer.prototype.getChannels = function(_app, _channel) {
  return this.channels[_app + '^' + _channel];
};

ChannelServer.prototype.getServerName = function() {
  return this.serverName;
};

ChannelServer.prototype.onGet = function(_url, _fn) {
  var searchIndex = -1;
  for (var inx = 0; searchIndex < 0 && inx < this.server.router.routes.GET.length; inx++) {
    if (this.server.router.routes.GET[inx].spec.path + "" === _url + "") {
      searchIndex = inx;
    }
  }

  if (searchIndex > -1) {
    this.server.router.routes.GET.splice(searchIndex, 1);
  }

  this.server.get(_url, _fn);
};


ChannelServer.prototype.onPost = function(_url, _fn) {
  var searchIndex = -1;
  for (var inx = 0; searchIndex < 0 && inx < this.server.router.routes.POST.length; inx++) {
    if (this.server.router.routes.POST[inx].spec.path + "" === _url + "") {
      searchIndex = inx;
    }
  }

  if (searchIndex > -1) {
    this.server.router.routes.POST.splice(searchIndex, 1);
  }

  this.server.post(_url, _fn);
};

ChannelServer.prototype._addNamespace = function(__INTERNAL_ONLY) {

  if (this.nsps) {
    var _self = this;
    this.nsps.forEach(function(entry) {
      _self.io.of(entry.nsp).use(entry.fnUse).on('connection', entry.fnConnection);
    });
  }

}

ChannelServer.prototype.addNamespace = function(nsp, fnUse, fnConnection) {

  if (!this.nsps) this.nsps = [];

  this.nsps.push({
    nsp: nsp,
    fnUse: fnUse, /* function (socket, next) { ... } */
    fnConnection: fnConnection /* function (socket) {...} */
  });

}

ChannelServer.prototype.send = function(argJson) {

  if (argJson.socketId) {
    self._sendPrivate(argJson.server, argJson.socketId, argJson.name, argJson.data, argJson.namespace);
  } else {
    self._sendOnce(argJson.app, argJson.channel, argJson.name, argJson.data, argJson.namespace);
  }

};

// exports
exports = module.exports = new ChannelServer();
exports.ChannelServer = ChannelServer;

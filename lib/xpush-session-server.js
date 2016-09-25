var EventEmitter = require('events').EventEmitter;
var util = require('util');
var async = require('async');
var shortId = require('shortid');

var Utils = require('./util/utils');
var NodeConstants = require('./node-manager/constants');
var NodeManager = require('./node-manager/node-manager.js').NodeManager;
var SessionManager = require('./session-manager/session-manager.js').SessionManager;

function SessionServer() {

  if (!(this instanceof SessionServer)) return new SessionServer();

  EventEmitter.call(this);

}

util.inherits(SessionServer, EventEmitter);

SessionServer.prototype.init = function (server, options, cb) {

  this.conf = {
    host: options.host,
    port: options.port,
    zookeeper: options.zookeeper,
    redis: options.redis
  };

  if( options.channelProtocol ){
    this.conf.channelProtocol= options.channelProtocol
  }

  // SERVER CONFIGURATION
  this.conf.balancing = {
    SCALE: 60,
    BUFFER_COUNT: 10,
    MAX_LEVEL: 4,
    REPLICA_BASE_NUMBER: 4
  };

  this.replicaMap = {};

  var self = this;

  try {

    async.parallel(
      [ // ASYNC ARRAY (START)

        function (callback) { // # 1

          var address;
          if (self.conf.zookeeper) {
            if (typeof self.conf.zookeeper === 'string' || self.conf.zookeeper instanceof String) {
              address = self.conf.zookeeper;
            } else {
              if (self.conf.zookeeper.address)  address = self.conf.zookeeper.address;
            }
          }

          self.nodeManager = new NodeManager(
            address,
            true,
            function (err, message) {
              if (!err) {
                console.info(' (init) ZOOKEEPER is connected');
                self.nodeManager.createEphemeralPath(
                  NodeConstants.META_PATH + NodeConstants.GW_SERVER_PATH + '/' + self.conf.host + ':' + self.conf.port,
                  function (err, message) {
                    console.info('        ZOOKEEPER /' + self.conf.host + ':' + self.conf.port);

                    // init balacing config
                    self.nodeManager.getConfigInfo('balancing', function (data) {
                      if (data) {
                        self.conf.balancing = data;
                      }
                    });

                    callback(err, message);
                  }
                );
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

          self._startup(server);

          if (cb) cb();

        } else {

          for (var errNum in results) {
            if (results.hasOwnProperty(errNum)) {
              if (results[errNum]) {
                console.error('  - ' + results[errNum] + '\n');
              }
            }
          }

          process.exit(1);
        }
      }
    );
  } catch (err) {
    console.error('Session server startup ERROR : ' + err);
  }
};


SessionServer.prototype._startup = function (server) {

  this.server = server;

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

  server.get('/node/:app/:channel', function (req, res, next) {

    self.getNewChannelServer(req.params.app, req.params.channel, function (serverInfo) {

      if (!serverInfo) {
        res.send({
          status: 'error',
          result: {
            message: 'Channel server is not available.'
          }
        });

      } else {
        res.send({
          status: 'ok',
          result: {
            seq: self.generateId(),
            channel: serverInfo.channel,
            server: serverInfo
          }
        });

      }

      next();
    });

  });

};

SessionServer.prototype.getNewChannelServer = function (_app, _channel, fn) {

  var self = this;

  var maxConnection = Number(self.conf.balancing['SCALE']) * ( Number(self.conf.balancing['MAX_LEVEL']) / 2 );

  this.sessionManager.retrieveConnectedNode(_app, _channel, function (res) {

    var server = "";

    if (res) { // already existed in redis.

      var mServer = "";
      var count = -1;

      for (var key in res) {
        if (res.hasOwnProperty(key)) {

          var _c = parseInt(res[key]);
          //console.log('STEP 1.', key, _c);
          if (_c < maxConnection) { // MAX_CONNECTION
            server = key;
            count = _c;
            break;

          } else {

            if (count > -1) {
              if (_c < count) {
                count = _c;
                mServer = key;
              }
            } else {
              count = _c;
              mServer = key;
            }

          }
        }
      }

      if (!server) {
        var nodeMap = self.nodeManager.getNodeMap();
        //console.log('STEP 2-1.', nodeMap);

        for (var name in nodeMap) {
          //console.log('STEP 2-2.', name, parseInt(res[name]), !res[name]);
          if (!res[name]) {
            server = name;
            break;
          }
        }
      }

      if (!server) server = mServer;

    }

    var serverInfo = '';
    if (server) {
      serverInfo = self.nodeManager.getServerNodeByName(server);

      if (!serverInfo) { // remove the server data from redis session storage.
        //self.sessionManager.remove(_app, _channel, server);
      }
    }

    if (serverInfo
      && serverInfo.replicas != self.replicaMap[server]) {
      self.replicaMap[server] = serverInfo.replicas;

      serverInfo = 0;
    }

    // Max reached
    if (serverInfo && serverInfo.replicas == 1) {
      serverInfo = 0;
    }

    // TODO In the case Not Existed serverNode Object !!
    var serverNode = {};
    if (!serverInfo) {

      serverNode = self.nodeManager.getServerNode(_channel);

      if (!serverNode) {

        return fn();

      }
    } else {
      serverNode = serverInfo;
    }

    fn({
      channel: _channel,
      name: serverNode.name,
      url: Utils.setHttpProtocal(serverNode.url, self.conf.channelProtocol)
    });

  });
};

SessionServer.prototype.onGet = function (_url, _fn) {
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

SessionServer.prototype.onPost = function (_url, _fn) {
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

SessionServer.prototype.onPut = function (_url, _fn) {
  var searchIndex = -1;
  for (var inx = 0; searchIndex < 0 && inx < this.server.router.routes.PUT.length; inx++) {
    if (this.server.router.routes.PUT[inx].spec.path + "" === _url + "") {
      searchIndex = inx;
    }
  }

  if (searchIndex > -1) {
    this.server.router.routes.PUT.splice(searchIndex, 1);
  }

  this.server.put(_url, _fn);
};

SessionServer.prototype.onDelete = function (_url, _fn) {
  var searchIndex = -1;
  for (var inx = 0; searchIndex < 0 && inx < this.server.router.routes.DELETE.length; inx++) {
    if (this.server.router.routes.DELETE[inx].spec.path + "" === _url + "") {
      searchIndex = inx;
    }
  }

  if (searchIndex > -1) {
    this.server.router.routes.DELETE.splice(searchIndex, 1);
  }

  this.server.del(_url, _fn);
};

SessionServer.prototype.generateId = function () {
  return shortId.generate();
};

// exports
exports = module.exports = new SessionServer();
exports.SessionServer = SessionServer;

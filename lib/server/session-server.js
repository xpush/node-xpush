var events   = require('events'),
    restify  = require('restify'),
    util     = require('util'),
    _        = require('underscore'),
    async    = require('async'),
    shortId  = require('shortid'),

    SvrUtils    = require('./utils'),
    NodeConstants  = require('../node-manager/constants'),
    NodeManager    = require('../node-manager/node-manager.js').NodeManager,
    SessionManager = require('../session-manager/session-manager.js').SessionManager,
    Database       = require('../mongodb-persister/database'),
    mongoPersister = require('../mongodb-persister/mongoPersister');

var SessionServer = exports.SessionServer = function(options, cb) {

  if (!options || !options.port) {
    throw new Error('Both `options` and `options.port` are required.');
  }

  var self = this;

  if (!options.host) options.host = options.host ? options.host : SvrUtils.getIP();

  var _killProcess = function() {

    if (self.nodeManager) {
      self.nodeManager.removePath(
      NodeConstants.META_PATH + NodeConstants.GW_SERVER_PATH + '/' + self.conf.host + ':' + self.conf.port, process.exit);
    }
  };
  process.on('SIGINT', _killProcess).on('SIGTERM', _killProcess); // ctrl+c , kill process(except -9)

  events.EventEmitter.call(this);

  this.conf = {
    version: module.exports.version,
    host: options.host,
    port: options.port,
    zookeeper: options.zookeeper,
    mongodb: options.mongodb,
    redis: options.redis
  };

  // TODO zookeeper 에서 watching 하고 있는 Global Configuration 을 this.conf.server = {max-connection: 100, some-key : some-value} 저장
  // TODO bin/xpushCli 를 통해서 설정값은 동적으로 변경 가능하도록 구현 (remove->create)

  if (options.max) {
    this.conf.max = options.max;
  }else{
    this.conf.max = 100;
  }

  if (options.restify) this.conf.restify = options.restify;
  if (options.oauth) this.conf.oauth = options.oauth;
  if (options.apps) this.conf.apps = options.apps;

  this.isStarted = false;

  this.methods = {
    GETS: {},
    POSTS: {},
    staticFiles: {}
  };

  this.server = restify.createServer(this.conf);

  try {

    async.parallel([

    /**
     * 1. mongodb connection
     * default mongo DB name은 `xpush`
     */
    function(callback) {

      Database.config(
        self.conf && self.conf.mongodb && self.conf.mongodb.address ? self.conf.mongodb.address : '', 'xpush',
        //options.mongodb && options.mongodb && options.mongodb.options ? options.mongodb.options : undefined,
        self.conf.mongodb && self.conf.mongodb.options ? self.conf.mongodb.options : undefined,
        function(err, message) {
          if (!err) console.info('  - Mongodb is connected');
          callback(err, message);
        }
      );
    },

    /**
     * 2. node-manager
     * NodeManager를 생성하여 zookeeper를 초기화한 후, 현재 서버 정보를 zookeeper에 등록한다.
     */
    function(callback) {

      self.nodeManager = new NodeManager(
        self.conf && self.conf.zookeeper && self.conf.zookeeper.address ? self.conf.zookeeper.address : '',
        true,
        function(err, message) {
          if (!err) {
            console.info('  - Zookeeper is connected');
            self.nodeManager.createEphemeralPath(NodeConstants.META_PATH + NodeConstants.GW_SERVER_PATH + '/' + self.conf.host + ':' + self.conf.port, function(err) {
              console.info('  - Session Server Node is created');
              callback(err);
            });

            if (self.conf.apps) {
              for (var i = 0; i < self.conf.apps.length; i++) {
                self.nodeManager.addAppNode(
                self.conf.apps[i].id,
                self.conf.apps[i].name,
                self.conf.apps[i],

                function(err) {
                  console.log(self.nodeManager.getAppInfos());
                });
              }
            }
          } else {
            callback(err, message);
          }
        }
      );
    },

    /**
     * 3. session-manager
     * SessionManager를 생성하여 Redis에 접속한다.
     */
    function(callback) {

      self.sessionManager = new SessionManager(
        self.conf && self.conf.redis && self.conf.redis.address ? self.conf.redis.address : '',

        function(err, message) {
          console.info('  - Redis is connected');
          callback(err, message);
        }
      );
    }],

    // And then, STARTUP !!
    function(err, results) {

      if (!err) {

        self.startup();

        if(cb) cb();

      } else {

        for(var errNum in results){
          if(results[errNum]) console.error(results[errNum]);
        }
        throw new Error(results);
      }
    });
  } catch (err) {
    console.log(err);
  }
};

util.inherits(SessionServer, events.EventEmitter);

SessionServer.prototype.startup = function() {

  var self = this;

  this.server.use(restify.queryParser());
  this.server.use(restify.bodyParser());
  this.server.use(restify.CORS({
    origins: ['*:*']
  }));
  this.server.use(restify.fullResponse());
  this.server.use(restify.jsonp());

  function unknownMethodHandler(req, res) {
    if (req.method.toUpperCase() === 'OPTIONS') {
      console.log('Received an options method request from: ' + req.headers.origin);
      var allowHeaders = ['Accept', 'Accept-Version', 'Content-Type', 'Api-Version', 'Origin', 'X-Requested-With', 'Authorization'];

      if (res.methods.indexOf('OPTIONS') === -1) {
        res.methods.push('OPTIONS');
      }

      res.header('Access-Control-Allow-Credentials', false);
      res.header('Access-Control-Expose-Headers', true);
      res.header('Access-Control-Allow-Headers', allowHeaders.join(', '));
      res.header('Access-Control-Allow-Methods', res.methods.join(', '));
      res.header('Access-Control-Allow-Origin', req.headers.origin);
      res.header('Access-Control-Max-Age', 1209600);

      return res.send(204);
    } else {
      return res.send(new restify.MethodNotAllowedError());
    }
  }
  this.server.on('MethodNotAllowed', unknownMethodHandler);

  this.server.on('XPUSH-send', function(params) {
    console.log(params);
    self.send(params);
  });

  this.server.get('/status/ping', function(req, res, next) {
    res.send({
      status: 'ok',
      result: {
        message: 'pong'
      }
    });

    next();
  });

  /** ### /node/{app}/{channel}
   * application ID 와 channel ID를 받아 접속해야할 channel server 정보를 return한다.
   */
  this.server.get('/node/:app/:channel', function(req, res, next) {

    self.getNewChannelServer(req.params.app, req.params.channel, function(serverInfo) {

      var _seq = shortId.generate();

      res.send({
        status: 'ok',
        result: {
          seq: _seq,
          channel: req.params.channel,
          server: serverInfo
        }
      });

      next();
    });

  });

  /** ### /auth
   * user ID와 device ID를 받아, session token을 생성하고 접속해야할 server 정보를 return한다.
   */
  this.server.post('/auth', function(req, res, next) {

    var err = SvrUtils.validEmptyParams(req, ['A', 'U', 'D', 'PW']);

    var mode ='NORMAL'; // or 'FORCE' or 'UNIQUE'
    if(req.params.MD){
      mode = req.params.MD;
    }

    if (err) {
      res.send({ status: 'ERR-PARAM', message: err });
      return;
    }

    async.waterfall([
      function(callback){

        if(mode.indexOf('ADD_DEVICE') > -1){
          mongoPersister.retrieveUser( {
            A: req.params.A,
            U: req.params.U
          }, callback);
        } else {
          mongoPersister.retrieveUser( {
            A: req.params.A,
            U: req.params.U,
            D: req.params.D
          }, callback);
        }

      },
      function(user, callback){

        if (!user) {
          res.send({ status: 'ERR-NOTEXIST', message: 'User is not existed.' });
          return;
        }

        var _pw = SvrUtils.encrypto(req.params.PW);

        // PW 가 동일한지 비교
        if (user.PW == _pw) {

          if(mode.indexOf('UNIQUE') > -1){

            if(user.DS[req.params.D].TK) {

              var serverNode = self.nodeManager.getServerNode(req.params.A + req.params.U);
              var _url = SvrUtils.setHttpProtocal(serverNode.url);

              res.send({
                status: 'ERR-LOGINED',
                result: {
                  'token': user.DS[req.params.D].TK,
                  'server': serverNode.name,
                  'serverUrl': _url,
                  'user': user
                }
              });

              return next();
            }
          }

          // `ADD_DEVICE` mode일때, mongoDB에 device를 추가한다.
          if(mode.indexOf('ADD_DEVICE') > -1){
            mongoPersister.addDevice({
              A: req.params.A,
              U: req.params.U,
              D: req.params.D,
              N: req.params.N
            }, function(err) {
              user.DS[req.params.D].N = req.params.N;
              callback(err, user);
            });
          } else {
            callback(null, user);
          }

        } else {
          res.send({ status: 'ERR-PASSWORD', message: 'Password is not corrected' });
          return;
        }
      },
      function(user, callback){

        mongoPersister.updateUserToken({
          A : user.A,
          U : user.U,
          D : req.params.D,
          TK: SvrUtils.randomString(10) // <- Auth Token
        }, function(err, token) {
          callback(err, user, token);
        });

      }
    ], function (err, user, token) {
       if (err) {
         SvrUtils.sendErr(res, err);
         return;
       }

       var serverNode = self.nodeManager.getServerNode(req.params.A + req.params.U);
       var _url = SvrUtils.setHttpProtocal(serverNode.url);

       user.PW = undefined; // remove a password for the security policy.
       res.send({
         status: 'ok',
         result: {
           'token': token,
           'server': serverNode.name,
           'serverUrl': _url,
           'user': user
         }
       });
    });
  });

  if (!this.conf.type || this.conf.type != 'PROXY') {
    require('../routes/routes')(self.conf, this.server, this.nodeManager);
  }

  this.server.listen(this.conf.port, function() {

    self.isStarted = true;

    for (var key in self.methods.GETS) {
      self.server.get(key, self.methods.GETS[key]);
    }

    for (var key in self.methods.POSTS) {
      self.server.post(key, self.methods.POSTS[key]);
    }

    for (var key in self.methods.staticFiles) {
      console.log('HTTP static directory : ', self.methods.staticFiles[key].directory);
      self.server.get(key, restify.serveStatic(self.methods.staticFiles[key]));
    }

    self.emit('connected', /*self.server.url // http://0.0.0.0:8000 */
    self.conf.host, self.conf.port);

  });

  this.server._fireEvent = function(eventName, datas) {
    var _r = self.emit(eventName, datas);
    return _r;
  };

};

SessionServer.prototype.getNewChannelServer = function(_app, _channel, fn) {

  var self = this;

  this.sessionManager.retrieve(_app, _channel, function(res) {

    var server  = "";

    if(res){ // already existed in redis.

      var mServer = "";
      var count   = -1;

      for(var key in res){

        if( res[key] < self.conf.max ){ // MAX_CONNECTION
          server = key;
          count  = parseInt(res[key]);
          break;

        }else{

          if(count > -1){
            if (res[key] < count){
              count = parseInt(res[key]);
              mServer = key;
            }
          }else{
            count = parseInt(res[key]);
            mServer = key;
          }

        }
      }

      var nodeMap = self.nodeManager.getServerNodeByName(server);
      if(!server){
        for(var name in nodeMap){
          if( !res[name] ){
            server = name;

            // TODO 모든 체널 서버에 체널정보를 공유해야 함 (pub)
            break;
          }
        }
      }

      if(!server) server = mServer;

    }

    var serverInfo = '';

    if (server) {
      serverInfo = self.nodeManager.getServerNodeByName(server);

      if (!serverInfo) { // remove the server data from redis session storage.
        self.sessionManager.remove(_app, _channel, server);
      }
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
      url: SvrUtils.setHttpProtocal(serverNode.url)
    });

  });
};

SessionServer.prototype.send = function(params) { // A, C, S, SS, NM, DT

  var self = this;

  var _server = params.S;

  if (!_server) {

    this.sessionManager.retrieve(_app, _channel, function(res) {

      for(var key in res){

        self.sessionManager.publish( key, {
            _type: 'send',
            A : params.A,
            C : params.C,
            SS: params.SS,
            NM: params.NM,
            DT: params.DT
          });
      }
    });

  } else {
    self.sessionManager.publish(
    _server, {
      _type: 'send',
      A: params.A,
      C: params.C,
      SS: params.SS,
      NM: params.NM,
      DT: params.DT
    });
  }
};

SessionServer.prototype.get = function(_path, _fn) {
  if (this.isStarted) {
    this.server.get(_path, _fn);
  } else {
    this.methods.GETS[_path] = _fn;
  }
};

SessionServer.prototype.post = function(_path, _fn) {
  if (this.isStarted) {
    this.server.post(_path, _fn);
  } else {
    this.methods.POSTS[_path] = _fn;
  }
};

SessionServer.prototype.static = function(_path, _config) {

  //if(this.isStarted){
  this.server.get(_path, restify.serveStatic(_config));
  //}else{
  //  this.methods.staticFiles[_path] = _config;
  //}
};

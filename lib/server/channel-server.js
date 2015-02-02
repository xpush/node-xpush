var events   = require('events'),
    //compress = require('compression')(),
    util     = require('util'),
    async    = require('async'),
    path     = require('path'),
    fs       = require('fs'),
    shortId  = require('shortid'),
    _       = require('underscore'),
    send     = require('send'),                   // https://github.com/visionmedia/send
    imagemagick = require('imagemagick-native'),  // https://github.com/mash/node-imagemagick-native
    Busboy = require('busboy'),                   // https://github.com/mscdex/busboy

    serverUtils        = require('./utils'),
    GCon               = require('../util/global-config.js'),
    database           = require('../mongodb-persister/database'),
    NodeManager        = require('../node-manager/node-manager.js').NodeManager,
    SessionManager     = require('../session-manager/session-manager.js').SessionManager,
    SessionSubscriber  = require('../session-manager/session-subscriber.js').SessionSubscriber,
    mongoPersister     = require('../mongodb-persister/mongoPersister'),
    Gcm                = require('../mobile/gcm').Gcm;

var gcmObject = {};

/**
 * @module
 * @name ChannelServer
 */
var ChannelServer = exports.ChannelServer = function(options, cb) {
  for (var key in options.apps) {
    var appId = options.apps[key].id;
    var gcmApiKey = options.apps[key].notification.gcm.apiKey;

    // Server config에 Gcm Server key 가 있으면, Gcm 정보를 초기화한다.
    if (gcmApiKey !== '') {
      var gcm = new Gcm(gcmApiKey);
      gcmObject[appId] = gcm;
    }
  }

  if (!options || !options.port) {
    throw new Error('Both `options` and `options.port` are required.');
  }

  var self = this;

  if (!options.host) {
    options.host = options.host ? options.host : serverUtils.getIP();
  }

  // process가 종료될 때, 주키퍼에서 서버 노드를 삭제되고 새로운 Hash가 구성된다.
  var _killProcess = function() {
    self.nodeManager.removeServerNode(options.host, options.port, process.exit);
  };

  process.on('SIGINT', _killProcess).on('SIGTERM', _killProcess); // ctrl+c , kill process(except -9)

  events.EventEmitter.call(this);

  this.options = options;

  this.options.server = {
    REDIS_EXPIRE : 120 // Redis TTL (seconds)
  };

  // inner storage for socket ids.
  this.socketIds = {};
  this.proc = 'CHANNEL';

  // inner storage for channels
  this.channels = {}; // {U, D, N}
  this.multiChannels = {};

  this.methods = {
    SESSION_SOCKET: {},
    CHANNEL_SOCKET: {}
  };

  try {

    async.parallel(
    [

    /**
     * 1. mongodb connection
     * default mongo DB name은 `xpush`
     */
    function(callback) {

      database.config(
        self.options && self.options.mongodb && self.options.mongodb.address ? self.options.mongodb.address : '',
        'xpush',
        self.options.mongodb && self.options.mongodb && self.options.mongodb.options ? self.options.mongodb.options : undefined,
        function(err, message) {
          if (!err) {
            console.info('  - Mongodb is connected');
          }
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
        self.options && self.options.zookeeper && self.options.zookeeper.address ? self.options.zookeeper.address : '',
        true,
        function(err, message) {
          if (!err) {
            console.info('  - Zookeeper is connected');
            self.nodeManager.addServerNode(self.options.host, self.options.port, self.options.weight, function(err, path) {
              if (!err) console.info('  - Channel Server Node is created : ' + path);

              var serverName = path.substring(path.lastIndexOf('/') + 1, path.length);
              self.serverName = serverName.split('^')[0];

              callback(err);
            });
          } else {
            callback(err, message);
          }
        }
      );

      GCon.setZKClient( self.nodeManager.zkClient , 'xpush' );
      GCon.onAll(function(key){

        GCon.getConfig( key, function(value){
          self.options.server[key.toUpperCase()] = Number(value);
        });

      });
    },

    /**
     * 3. session-manager
     * SessionManager를 생성하여 Redis에 접속한다.
     */
    function(callback) {

      self.options.redis.expire = self.options.server.REDIS_EXPIRE;

      self.sessionManager = new SessionManager(
        self.options && self.options.redis ? self.options.redis : undefined,
        function(err, message) {
          if (!err) console.info('  - Redis is connected');
          callback(err, message);
        }
      );
    }],

    /**
     * 접속이 완료되면, SessionSubscriber를 생성한다.
     * Session Manager는 Redis를 이용하여 pub-sub을 할 떄 사용한다.
     */
    function(err, results) {

      if (!err) {

        self.sessionSubscriber = new SessionSubscriber(
          self.options && self.options.redis && self.options.redis ? self.options.redis : undefined,
          self.serverName,
          function(err) {
            if (!err) console.info('  - Redis Substriber is connected');
            if (!err) self.startup();
          }
        );

        if(cb) cb();

      } else {

        for(var errNum in results){
          if(results[errNum]) {
            console.error('  - '+results[errNum]+'\n');
          }
        }

        process.exit(1);
      }

    });

  } catch (err) {
    console.error('Channel server startup ERROR : '+err);
  }
};

util.inherits(ChannelServer, events.EventEmitter);

ChannelServer.prototype.startup = function() {

  var self = this;

  var app  = require('express')();
  var http = require('http').Server(app);
  var ss   = require('socket.io-stream');

  this.io = require('socket.io')(http);

  app.get('/status/ping', function(req, res) {
    res.send({
      status: 'ok',
      result: {
        message: 'pong'
      }
    });
  });

  /** ### /upload
   * multipart 형태로 file upload 를 수행한다. mobile 기기에서 업로드할 때 사용
   */
  app.post('/upload', function(req, res) {

    var _app      = req.headers['xp-a'];
    var _channel  = req.headers['xp-c'];
    var _userInfo = JSON.parse(req.headers['xp-u']); //[U]^[D]^[TK]

    var _org      = req.headers['xp-fu-org'];
    var _nm       = req.headers['xp-fu-nm' ];
    var _tp       = req.headers['xp-fu-tp' ];

    var isAuth = false;
    var _users = self.channels[_app + '^' + _channel];

    // token을 체크하여 login 상태인지 확인한다.
    for (var i=0; _users && i<_users.length; i++){
      if(_users[i].U == _userInfo.U){ // @ TODO check token !!!!!!!! IMPORTANT
        isAuth = true;
        break;
      }
    }

    if(!isAuth){
      res.writeHead(200, { 'Connection': 'close', 'Content-Type': 'application/json' });
      res.end(JSON.stringify(
        {
          status: 'ERR-AUTH',
          result: 'What the hell your token is not available!! Are you hack?'
        }
      ));
      return;
    }

    var uploadPath = path.join(
      self.options.home,
      self.options.upload || 'upload',
      _channel
    );

    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, 0766);

    var ext = (_org) ? _org.substring(_org.lastIndexOf('.') + 1, _org.length) : null;
    var fileName = _nm || shortId.generate();
    fileName = fileName.replace(/ /g,'');
    if(ext) fileName = fileName +'.'+ext;

    var busboy = new Busboy({ headers: req.headers });
    busboy.on('file', function(__fieldname, __file, __filename, __encoding, __mimetype) {
      //var saveTo = path.join(os.tmpDir(), path.basename(fieldname));
      __file.pipe(fs.createWriteStream(path.join(uploadPath, fileName)));
    });
    busboy.on('finish', function() {

      // image type인 경우 imagemagick를 이용하여 150 x 150 크기의 thumbnail 이미지를 생성한다.
      if(_tp == 'image'){
        var srcData = fs.readFileSync(path.join(uploadPath, fileName));
        var resizedBuffer = imagemagick.convert({
            srcData: srcData,
            /*debug: 1,
            ignoreWarnings: 1, */
            width: 150,
            height: 150,
            resizeStyle: "aspectfit", // aspectfit:  keep aspect ratio, get maximum image that fits inside provided size
            quality: 80,
            format: 'JPEG'
        });

        // thumbnail의 경우, T_ prefix 가 붙는다.
        fs.writeFile(path.join(uploadPath, 'T_'+fileName), resizedBuffer, 'binary', function (err) {
          if (err) throw err;
          res.writeHead(200, { 'Connection': 'close', 'Content-Type': 'application/json' });
          res.end(JSON.stringify(
            {
              status: 'ok',
              result: {
                channel: _channel,
                name: fileName,
                tname: 'T_'+fileName
              }
            }
          ));
        });
      }else{

        res.writeHead(200, { 'Connection': 'close', 'Content-Type': 'application/json' });
        res.end(JSON.stringify(
          {
            status: 'ok',
            result: {
              channel: _channel,
              name: fileName
            }
          }
        ));
      }

    });
    return req.pipe(busboy);
  });

  /** ### /download/
   * 업로드된 파일을 다운로드하기 위한 REST API. thumbnail의 경우 세션 체크를 하지 않는다.
   */
  app.get('/download/:app/:channel/:userId/:socketId/:filename', function(req, res) {

    var isConnected = false;
    if(req.params.filename.indexOf('T_') == 0){ // for thumbnail images
      isConnected = true;
    }else{
      var _users = self.channels[req.params.app + '^' + req.params.channel];
      for (var i=0; _users && i<_users.length; i++){
        if(_users[i].U == req.params.userId){
          // socketId를 이용하여  channel에 접속되어 있는지 확인한다.
          if(self.io.of('/channel').connected[req.params.socketId]){
            isConnected = true;
            break;
          }
        }
      }
    }

    if(isConnected){

      var httpRoot = path.join(
        self.options.home,
        self.options.upload || 'upload');

      send(req, req.params.channel+'/'+req.params.filename, {root: httpRoot})
        .on('error',  function (err) {
          res.statusCode = err.status || 500;
          res.end(err.message);
        })
        .on('directory', function () {
          res.statusCode = 301;
          res.setHeader('Location', req.url + '/');
          res.end('Redirecting to ' + req.url + '/');
        })
        //.on('headers', function (res, path, stat) {
        //  res.setHeader('Content-Disposition', 'attachment');
        //})
        .pipe(res);

    }else{

      res.statusCode = 404;
      res.end('Not connected in channel');

    }
  });

  /**
   * applicationId, userId, token, deviceId를 사용하여 session socket을 생성한다.
   */
  this.io.of('/session').use(function(socket, callback) {

    var handshakeData = socket.request;
    var _app       = handshakeData._query.A;
    var _userId    = handshakeData._query.U;
    var _deviceId  = handshakeData._query.D;
    var _token     = handshakeData._query.TK;

    if (!_app || !_userId || !_token || !_deviceId) {
      callback('Parameter is not corrected. (A, U, D, TK)', false);
      return;
    }

    mongoPersister.retrieveUser({
      A: _app,
      U: _userId,
      D: _deviceId
    }, function(err, user) {
      console.log(err);
      if (err) {
        callback(err, false);
        return;
      }

      if (!user) {
        callback('User is not existed.', false);
        return;
      } else {

        // token 확인
        if (user.DS[_deviceId].TK == _token) {
          console.log('== session == '.red, _app.red, _userId.red, _deviceId.red);
          callback(null, true);
        } else {
          callback('Auth token is not available.', false);
        }
        return;
      }

    });

  }).on('connection', function(socket) {

    console.log("Authorization and connection".blue);

    /**
     * session socket의 중복여부를 체크한다. session socket의 ID는 application ID, User ID, device ID를 조합하여 생성한다.
     */
    var _socketId = self.socketIds[socket.handshake.query.A + '_' + socket.handshake.query.U + '_' + socket.handshake.query.D];
    var _socket = self.io.of('/session').connected[_socketId];

    // 이미 존재하는 session 소켓이 있는 경우, 다른 브라우져에서 로그인을 하고 있는 상태이기 때문에, 해당 브라우져로 LOGOUT 이벤트를 발생시킨다.
    if (_socket && _socket.id != undefined) {

      _socket.emit('_event', {
        event: 'LOGOUT',
        A: socket.handshake.query.A,
        U: socket.handshake.query.U,
        D: socket.handshake.query.D
      });
      _socket.disconnect();

      delete self.socketIds[socket.handshake.query.A + '_' + socket.handshake.query.U + '_' + socket.handshake.query.D];
    }

    // socket id를 local storage에 저장한다.
    self.socketIds[
      socket.handshake.query.A + '_' + socket.handshake.query.U + '_' + socket.handshake.query.D
    ] = socket.id;

    console.log('socketIds key = ' + socket.handshake.query.A + '_' + socket.handshake.query.U + '_' + socket.handshake.query.D);
    console.log('== session socket id =='.red, socket.id.red);

    /**
     * Channel을 생성한 후, 생성한 정보를 callback으로 넘겨준다.
     * @name channel-create
     * @event
     * @param {object} params - JSON 형태의 data ( C, U, DT )
     * @param {callback} callback - Channel 정보를 callback으로 넘겨준다.
     */
    socket.on('channel-create', function(params, callback) {

      if (!params.U || params.U.length === 0) {
        callback({
          status: 'ERR-PARAM',
          message: 'Channel have to include user(s).'
        });
        return;
      }
      console.log("====== channel-create", params);

      // MongoDB에 저장
      mongoPersister.createChannel({
        A : socket.handshake.query.A,
        C : params.C, // optional (can auto-generate !)
        U : params.U,
        DT: params.DT
      }, function(err, data) {

        if (err) {
          console.log(err);
          if (callback) {
            if( err == 'ERR-EXISTED'){
              // 채널이 존재할 경우 Warning 메시지를 return함
              callback({
                status: 'WARN-EXISTED',
                message: '['+params.C+'] channel is alread existed'
              });
            }else{
              callback({
                status: 'ERR-INTERNAL',
                message: err
              });
            }
          }
        } else {
          // Redis에서 Channel Server 정보를 찾은 후, 각 서버에 publish 한다. @TODO check the comment
          self.sessionManager.retrieve(socket.handshake.query.A, data.C, function(res) {
            for(var key in res){
              self.sessionManager.publish(
                key, {
                  _type: 'createChannel', /* IMPORTANT */
                  A : socket.handshake.query.A,
                  C : params.C,
                  US: data.US
                });
            }
          });

          // @TODO !!
          //self.channels[data.app+'^'+data.channel] = data.users;

          if (callback) callback({
            status: 'ok',
            result: data
          });

        }
      });
    });

    /**
     * Channel list를 조회한 후, array를 callback으로 넘겨준다.
     * @name channel-list
     * @event
     * @param {callback} callback - Channel arary를 callback으로 넘겨준다.
     */
    socket.on('channel-list', function(callback) {
      mongoPersister.listChannel({
        A: socket.handshake.query.A,
        U: socket.handshake.query.U
      }, function(err, channels) {
        if (err) {
          console.log(err);
          if (callback) callback({
            status: 'error',
            message: err
          });

        } else {
          if (callback) callback({
            status: 'ok',
            result: channels
          });
        }
      });
    });

    /**
     * Channel 정보를 update한다. Q는 mongoDB의 update query 형태를 사용한다.
     * @name channel-update
     * @event
     * @param {object} params - JSON 형태의 data ( C, Q )
     * @param {callback} callback - update된 Channel 정보를 callback으로 넘겨준다.
     */
    socket.on('channel-update', function(params, callback) {
      console.log('channel-update');
      mongoPersister.updateChannel({
        A: socket.handshake.query.A,
        C: params.C,
        Q: params.Q
      }, function(err, data) {
        if (err) {
          console.log(err);
          if (callback) callback({
            status: 'error',
            message: err
          });

        } else {
          if (callback) callback({
            status: 'ok',
            result: data
          });
        }
      });
    });

    /**
     * Channel 정보를 조회한 후, callback으로 return한다
     * @name channel-get
     * @event
     * @param {object} params - JSON 형태의 data ( C )
     * @param {callback} callback - Channel object를 callback으로 넘겨준다.
     */
    socket.on('channel-get', function(params, callback) {
      console.log('channel-get');
      mongoPersister.getChannel({
        A: socket.handshake.query.A,
        C: params.C
      }, function(err, channel, msg) {
        if (err) {
          if (callback) callback({
            status: 'ERR-INTERNAL',
            message: err
          });
        } else {
          if (channel) {
            if (callback) callback({
              status: 'ok',
              result: channel
            });
          } else {
            console.log('channel is not existed!'.red);
            if (callback) callback({
              status: 'ERR-NOTEXIST',
              message: 'channel is not existed!'
            });
          }
        }
      });
    });

    /**
     * Channel에서 나간다.
     * @name channel-exit
     * @event
     * @param {object} params - JSON 형태의 data ( C )
     * @param {callback} callback - Channel array를 callback으로 넘겨준다.
     */
    socket.on('channel-exit', function(params, callback) {

      var err = serverUtils.validSocketParams(params, ['C']);
      if (err) {
        if (callback) callback({
          status: 'ERR-PARAM',
          message: err
        });
        return;
      }

      // Channel내의 user array에서 현재 user를 뺀다.
      mongoPersister.exitChannel({
        A: socket.handshake.query.A,
        C: params.C,
        U: socket.handshake.query.U
      }, function(err, channels) {
        if (err) {
          if (callback) callback({
            status: 'ERR-INTERNAL',
            message: err
          });

        } else {

          // @TODO pull channels users and delete channels if user is not existed.

          // Channel 정보를 조회 후, 다른 서버에 채널 정보가 변경되었음을 알려준다.  @TODO check the comment
          self.sessionManager.retrieve(socket.handshake.query.A, params.C, function(res) {
            for(var key in res){
              self.sessionManager.publish(
                key, {
                  _type: 'exitChannelUser',
                  /* IMPORTANT */
                  A: socket.handshake.query.A,
                  C: params.C,
                  U: socket.handshake.query.U
                });
              }
            });

          if (callback) callback({
            status: 'ok',
            result: channels
          });
        }
      });

    });

    // ** DEPLICATED ** params : keys, values
    socket.on('user-list', function(params, callback) {
      mongoPersister.searchUser(
      socket.handshake.query.A,
      params.keys, // optional
      params.values, // optional
      params.page, // optional
      function(err, users, count) {
        if (err) {
          if (callback) callback({
            status: 'ERR-INTERNAL',
            message: err
          });
        } else {
          if (callback) callback({
            status: 'ok',
            result: {
              users : users,
              count : count
            }
          });
        }
      });

    });

    /**
     * DB에서 User 정보를 조회 후, callback 으로 넘겨준다.
     * @name user-query
     * @event
     * @param {object} params - JSON 형태의 data ( [query], [column], {options} )
     * @param {callback} callback - User array를 callback으로 넘겨준다.
     */
    socket.on('user-query', function(params, callback) {

      // @ TODO need checker on params (cuz security-token,password ... ).

      // like query
      if(params.query){
        params.query = serverUtils.likeQueryMaker( params.query );
      }

      mongoPersister.queryUser(
        socket.handshake.query.A,
        params.query,
        params.column,
        params.options,
        function(err, users, count) {
          if (err) {
            if (callback) callback({
              status: 'ERR-INTERNAL',
              message: err
            });
          } else {
            if (callback) callback({
              status: 'ok',
              result: {
                users : users,
                count : count
              }
            });
          }
      });
    });

    /**
     * 현재 channel에 연결된 사용자가 있는 channel list를 redis에서 조회한다.
     * @name channel-list-active
     * @event
     * @param {object} params - JSON 형태의 data ( key )
     * @param {callback} callback - User array를 callback으로 넘겨준다.
     */
    socket.on('channel-list-active', function(params, callback) {
      console.log('channel-list-active',params);
      var appId = socket.handshake.query.A;
      var subKeyPattern = params.key;
      /*
      if (params.key != null && params.key != undefined) {
        appId = appId + ":" + params.key;
      }
      */
      self.sessionManager.retrieveChannelList(appId,subKeyPattern,function(err,results){
        console.log(results);

        if (callback) {
          if(err){
            callback({ status: 'ERR-INTERNAL', message: err });
          }else {
            callback({
              status: 'ok',
              result: results
            });
          }
        }
      });

      /*
      self.sessionManager.retrieveChannelList(appId, function(channels) {
        var results = [];

        for (var key in channels) {
          var result = {};
          result[key] = JSON.parse(channels[key]);
          results.push(result);
        }

        if (callback) callback({
          status: 'ok',
          result: results
        });

      });
      */
    });

    /**
     * socket이 연결되지 않았거나, GCM을 사용하지 않아 전송을 하지 못한 모든 channel내의 message( unread message )를 조회한다.
     * @name message-unread
     * @event
     * @param {callback} callback - message array를 callback으로 넘겨준다.
     */
    socket.on('message-unread', function(callback) {
      mongoPersister.unReadMessages({
        A: socket.handshake.query.A,
        C: '',
        U: socket.handshake.query.U,
        D: socket.handshake.query.D
      }, function(err, data) {
        if (err) {
          if (callback) callback({ status: 'ERR-INTERNAL', message: err });
          return;
        } else {
          if (callback) callback({
            status: 'ok',
            result: data
          });
        }
      });
    });

    /**
     * message-unread 수행 후 호출할 event로 mongo DB에서 해당 message를 DB에서 삭제한다.
     * @name message-received
     * @event
     * @param {callback} callback - 결과를 전송함.
     */
    socket.on('message-received', function(callback) {
      mongoPersister.removeUnReadMessages({ // A, C, U, D
        A: socket.handshake.query.A,
        C: '',
        U: socket.handshake.query.U,
        D: socket.handshake.query.D
      }, function(err, data) {
        if (err) {
          if (callback) callback({ status: 'ERR-INTERNAL', message: err });
          return;
        } else {

          if (callback) callback({
            status: 'ok',
            result: data
          });

        }
      });
    });

    /**
     * Group내 포함된 User 목록을 조회한다.
     * @name group-list
     * @event
     * @param {object} params - JSON 형태의 data ( GR )
     * @param {callback} callback - User 목록을 callback으로 전송한다.
     */
    socket.on('group-list', function(params, callback) {
      var err = serverUtils.validSocketParams(params, ['GR']);
      if (err) {
        if (callback) callback({ status: 'ERR-PARAM', message: err });
        return;
      }

      mongoPersister.listGroup({
        A : socket.handshake.query.A,
        GR: params.GR
      }, function(err, users) {
        if (err) {
          if (callback) callback({ status: 'ERR-INTERNAL', message: err });
        } else {
          if (callback) callback({ status: 'ok', result: users });
        }
      });
    });

    /**
     * 하나 또는 다수의 User의 group id를 추가한다.
     * @name group-add
     * @event
     * @param {object} params - JSON 형태의 data ( U, GR )
     * @param {callback} callback - 결과를 callback으로 전송한다.
     */
    socket.on('group-add', function(params, callback) {
      var err = serverUtils.validSocketParams(params, ['U', 'GR']);
      if (err) {
        if (callback) callback({ status: 'ERR-PARAM', message: err });
        return;
      }

      mongoPersister.addGroupId({
        A : socket.handshake.query.A,
        U : params.U,
        GR: params.GR
      }, function(err) {
        if (err) {
          if (callback) callback({ status: 'ERR-INTERNAL', message: err });
        } else {
          if (callback) callback({
            status: 'ok'
          });
        }
      });
    });

    /**
     * user를 group에서 삭제한다.
     * @name group-remove
     * @event
     * @param {object} params - JSON 형태의 data ( U, GR )
     * @param {callback} callback - 결과를 callback으로 전송한다.
     */
    socket.on('group-remove', function(params, callback) {
      var err = serverUtils.validSocketParams(params, ['U', 'GR']);
      if (err) {
        if (callback) callback({ status: 'ERR-PARAM', message: err });
        return;
      }

      mongoPersister.removeGroupId({
        A : socket.handshake.query.A,
        U : params.U,
        GR: params.GR
      }, function(err) {
        if (err) {
          if (callback) callback({ status: 'ERR-INTERNAL', message: err });
        } else {
          if (callback) callback({
            status: 'ok'
          });
        }
      });

    });

    /**
     * 연결 해제시 local session의 socket을 삭제한다.
     * @name disconnect
     * @event
     */
    socket.on('disconnect', function() {
      delete self.socketIds[socket.handshake.query.A + '_' + socket.handshake.query.U + '_' + socket.handshake.query.D];
    });

    // additional socket event.
    for (var key in self.methods.SESSION_SOCKET) {
      socket.on(key, self.methods.SESSION_SOCKET[key]);
    }

  });


  /** CHANNEL AUTHORIZATION **/
  this._channel_authorization = function(socket, callback) {

    var handshakeData = socket.request;

    // TODO
    // Check the channel is available (Existed? ) ?
    // or this is wasted ?
    var _app       = handshakeData._query.A;
    var _channel   = handshakeData._query.C;
    var _server    = handshakeData._query.S;
    var _userId    = handshakeData._query.U;
    var _deviceId  = handshakeData._query.D;
    //var _data      = handshakeData._query.DT;

    // #### CHANNEL_ONLY : using only channel namespace socket.
    var _mode = '';
    if (handshakeData._query.MD) _mode = handshakeData._query.MD;


    if (!_app || !_channel || !_server) {
      callback('Parameter is not corrected. (A, C, S) ', false);
      return;
    }

    if (_mode == 'CHANNEL_ONLY') { // without session socket Server.
      console.log(ChannelServer.proc);
      console.log(this.proc);
      console.log(self.proc);
      var _us = self.channels[_app + '^' + _channel];

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
      callback(null, true);

    } else {

      if (!self.channels[_app + '^' + _channel]) {

        mongoPersister.getChannel({
          A: _app,
          C: _channel
        }, function(err, channel, msg) {
          if (err) {
            console.log(err);
            callback(err, false);

          } else {
            if (channel) {
              self.channels[_app + '^' + _channel] = channel.US;
              callback(null, true);
            } else {
              console.log('channel is not existed!'.red);
              callback(msg, false);
            }

          }
        });

      }
      else {

        callback(null, true);
      }
    }

  };

  this._channel_send = function(params, callback, _this) {

    var socket = _this ? _this : this;

    var err = serverUtils.validSocketParams(params, ['NM', 'DT']);
    if (err) {
      if (callback) callback({ status: 'ERR-PARAM', message: err });
      return;
    }

    // socket Id가 존재하면 현재 server에서 전송한다.
    if (params.SS) {

      self._sendPrivate(
        params.S,  // server name
        params.SS, // socketId
        params.NM,
        params.DT,
        callback);

    } else {
      self._send(
        socket.handshake.query.A,
        socket.handshake.query.C,
        params.NM,
        params.DT,
        callback);
    }

  }

  this._channel_disconnect = function(_this) {

    var socket = _this ? _this : this;

    var _a = socket.handshake.query.A;
    var _c = socket.handshake.query.C;
    var _u = socket.handshake.query.U;
    var _s = socket.handshake.query.S;

    var _room = _a + '^' + _c;

    socket.leave(_room);

    var _count_of_this_channel = 0;
    if (socket.adapter.rooms[_room]) {
      _count_of_this_channel = Object.keys(socket.adapter.rooms[_room]).length;
    }

    // channel 내에 아무도 없으면 local cache에서 channel을 삭제함.
    if (_count_of_this_channel == 0) {

      delete self.channels[_a + '^' + _c];

      var _m = self.multiChannels[_a + '^' + _c];
      if(_m){

        var _ml = _m.length;
        for (var i = 0; i < _ml; i++) {
          self.sessionManager.publish( _m[i] , {
            _type: 'del-channel-server',
            A: _a,
            C: _c,
            S: _s
          });
        }
        delete self.multiChannels[_a + '^' + _c];
      }

    } else {

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

    // TODO mongo DB 에서도 삭제 되어야 함
    mongoPersister.removeActiveUser({A:_a,C:_c,U:_u},function(err){
      if(err) console.error(err);
    });


    self.emit('channel', { // @todo is it using ? channel is must be '_event'
      'event': 'update',
      'count': _count_of_this_channel,
      'A': _a,
      'C': _c,
      'S': socket.handshake.query.S
    });

  };


  /**
   * applicationId, channelId, server, userId, deviceId를 사용하여 channel socket을 생성한다.
   */
  this.io.of('/channel').use(self._channel_authorization).on('connection', function(socket) {

    var _room = socket.handshake.query.A + '^' + socket.handshake.query.C;
    console.log('channel socket connection : '+ socket.id +' / '+_room);

    socket.join(_room);

    socket._userId = socket.handshake.query.U;
    socket._deviceId = socket.handshake.query.D;

    var _count_of_this_channel = Object.keys(socket.adapter.rooms[_room]).length;

    // sessionManager의 channel 정보를 update한다.
    self.sessionManager.update(
      socket.handshake.query.A,
      socket.handshake.query.C,
      socket.handshake.query.S,
      _count_of_this_channel);


    if(_count_of_this_channel == 1){

      console.log('_count_of_this_channel : ', _count_of_this_channel);

      self.sessionManager.retrieve(socket.handshake.query.A, socket.handshake.query.C, function(res) {

        if(res){
          for(var key in res){
            console.log(key, socket.handshake.query.S, (key != socket.handshake.query.S));
            if(key != socket.handshake.query.S){

              console.log(socket.handshake.query.S+' --> '+key);
              self.sessionManager.publish( key , {
                _type: 'add-channel-server',
                A: socket.handshake.query.A,
                C: socket.handshake.query.C,
                S: socket.handshake.query.S
              });

              if(self.channels[_room]){
                if(!self.multiChannels[_room]){
                  self.multiChannels[_room] = [key];
                }else{
                  if(self.multiChannels[_room].indexOf(key) == -1) self.multiChannels[_room].push(key);
                }
              }

            }
          }
        }

      });

    }


    // connection 정보 mongodb에 저장
    mongoPersister.addActiveUser({
      A : socket.handshake.query.A,
      C : socket.handshake.query.C,
      U : socket.handshake.query.U,
      DT: socket.handshake.query.DT
    }, function(err, datas) {

      console.log("====save user session to mongod");
      if(err){
        if (callback) callback({ status: 'ERR-INTERNAL', message: err });
      }

      // redis 에 hset이 존재하는지 판단 후
      // 존재 하면 hset 한건
      // 존재 하지 않으면 from mongo to redis

      self.sessionManager.retrieveClients(
        socket.handshake.query.A,
        socket.handshake.query.C,
        function(err, data) {

          if (err) {
            if (callback) callback({ status: 'ERR-INTERNAL', message: err });
          } else {
            if(data){
              self.sessionManager.updateClient(
              socket.handshake.query.A,
              socket.handshake.query.C,
              socket.handshake.query.U,
              socket.handshake.query.DT);
            }else{
              console.log("save active user to session")
              mongoPersister.retrieveActiveUser({
                A : socket.handshake.query.A,
                C : socket.handshake.query.C
              },function(err,doc){

                if(doc){
                  for(var c in doc){

                    self.sessionManager.updateClient(
                      socket.handshake.query.A,
                      socket.handshake.query.C,
                      doc[c].U,
                      doc[c].DT);
                  }

                }
              });
            }
          }
        }
      );
    });

    self.emit('channel', { // @todo is it using ? must be '_event' ?
      event: 'update',
      count: _count_of_this_channel,
      A: socket.handshake.query.A,
      C: socket.handshake.query.C,
      S: socket.handshake.query.S
    });

    var _msgObj = {
      event: 'CONNECTION',
      count: _count_of_this_channel,
      A: socket.handshake.query.A,
      C: socket.handshake.query.C,
      U: socket.handshake.query.U
    };

    // 동일한 socket을 사용 중인 user에게 `CONNNECTION` EVENT를 발생시킨다.
    socket.broadcast.to(_room).emit('_event', _msgObj);
    socket.emit('_event', _msgObj);

    if(!self.methods.CHANNEL_SOCKET.hasOwnProperty('connection')) self.methods.CHANNEL_SOCKET.connection(socket);

    // params : U, DT
    socket.on('join', function(params, callback) {

      mongoPersister.addChannelUser({
        A : socket.handshake.query.A,
        C : socket.handshake.query.C,
        U : params.U,
        DT: params.DT
      }, function(err, datas) {
        console.log("====join", arguments);
        if(err){
          if (callback) callback({ status: 'ERR-INTERNAL', message: err });
        }

        for (var x = 0; x < datas.length; x++) {
          self.channels[socket.handshake.query.A + '^' + socket.handshake.query.C].push({
            U: datas[x].U,
            D: datas[x].D,
            N: datas[x].N
          });
        }

        if (callback) callback({
          status: 'ok'
        });

      });

    });

    /**
     * Message를 전송한다.
     * @name send
     * @event
     * @param {object} params - JSON 형태의 data ( NM, DT, SS )
     * @param {callback} callback - 결과를 callback으로 전송한다.
     */
    if(!self.methods.CHANNEL_SOCKET.hasOwnProperty('send')) socket.on('send', self._channel_send);

    /**
     * 현재 channel의 unread message를 조회한다.
     * @name message-unread
     * @event
     * @param {callback} callback - 결과를 callback으로 전송한다.
     */
    socket.on('message-unread', function(callback) {
      mongoPersister.unReadMessages({
        A: socket.handshake.query.A,
        C: socket.handshake.query.C,
        U: socket.handshake.query.U,
        D: socket.handshake.query.D
      }, function(err, data) {
        if (err) {
          if (callback) callback({ status: 'ERR-INTERNAL', message: err });
          return;
        } else {
          if (callback) callback({
            status: 'ok',
            result: data
          });
        }
      });
    });

    /**
     * 현재 channel의 unread message를 삭제한다.
     * @name message-received
     * @event
     * @param {callback} callback - 결과를 callback으로 전송한다.
     */
    socket.on('message-received', function(callback) {
      mongoPersister.removeUnReadMessages({
        A: socket.handshake.query.A,
        C: socket.handshake.query.C,
        U: socket.handshake.query.U,
        D: socket.handshake.query.D
      }, function(err, data) {
        if (err) {
          if (callback) callback({ status: 'ERR-INTERNAL', message: err });
          return;
        } else {
          if (callback) callback({
            status: 'ok',
            result: data
          });
        }
      });
    });

    socket.on('users', function(params, callback) {

      if (typeof(params) == 'function' && !callback) callback = params;

      // TODO 레디스에서 가져왔는데 없으면, mongo 에서 가져온 후 redis 에 넣도록 수정

      self.sessionManager.retrieveClients(
        socket.handshake.query.A,
        socket.handshake.query.C,
        function(err, data) {
          if (err) {
            if (callback) callback({ status: 'ERR-INTERNAL', message: err });
            return;
          } else {
            if(data&&callback){

              callback({
                status: 'ok',
                result: data
              });
            }else{//redis에 User Data가 없을때


              mongoPersister.retrieveActiveUser({
                A : socket.handshake.query.A,
                C : socket.handshake.query.C
              },function(err,doc){
                console.log(err);

                if(doc){
                  var result = {};

                  _.each(doc, function(value, inx){

                      var key =value["U"];

                      var o = "{\""+value.U+"\":\""+value.DT +"\"}";

                      _.extend(result,JSON.parse(o));

                      if(inx==Object.keys(doc).length-1){
                        self.sessionManager.synchronizeClient(
                        socket.handshake.query.A,
                        socket.handshake.query.C,
                        result,function(){
                          self.sessionManager.retrieveClients(
                          socket.handshake.query.A,
                          socket.handshake.query.C,
                          function(err, data) {
                            if (err) {
                              if (callback) callback({ status: 'ERR-INTERNAL', message: err });
                              return;
                            }
                            callback({
                              status: 'ok',
                              result: data
                            });
                          });
                        });
                      }
                  });
                }
              });
            }
          }
        }
      );
    });

    socket.on('usersNumberGeneral', function(params, callback) {

      if( typeof(params) == 'function' && !callback ) {
        callback = params;
      }

      mongoPersister.retrieveActiveUserCount({
        A : socket.handshake.query.A,
        C : socket.handshake.query.C
      },function(err,res){
        callback({
          status: 'ok',
          result: res
        });
      });
    });

    socket.on('usersNumber', function(params, callback) {

      if( typeof(params) == 'function' && !callback ) {
        callback = params;
      }

      // TODO 레디스에서 가져왔는데 없으면, mongo 에서 가져온 후 redis 에 넣도록 수정
      self.sessionManager.retrieveClientsCount(
        socket.handshake.query.A,
        socket.handshake.query.C,
        function(err, data) {
          if (err) {
            if (callback) callback({ status: 'ERR-INTERNAL', message: err });
            return;
          } else {
            if(data&&callback){

              callback({
                status: 'ok',
                result: data
              });
            }else{//redis에 User Data가 없을때
              mongoPersister.retrieveActiveUser({
                A : socket.handshake.query.A,
                C : socket.handshake.query.C
              },function(err,doc){
                console.log(err);

                if(doc){
                  var result = {};

                  _.each(doc, function(value, inx){

                      var key =value["U"];

                      var o = "{\""+value.U+"\":\""+value.DT +"\"}";
                      _.extend(result,JSON.parse(o));

                      if(inx==Object.keys(doc).length-1){
                        self.sessionManager.synchronizeClient(
                        socket.handshake.query.A,
                        socket.handshake.query.C,
                        result,function(){
                          self.sessionManager.retrieveClientsCount(
                          socket.handshake.query.A,
                          socket.handshake.query.C,
                          function(err, data) {
                            if (err) {
                              if (callback) callback({ status: 'ERR-INTERNAL', message: err });
                              return;
                            }
                            callback({
                              status: 'ok',
                              result: data
                            });
                          });
                        });
                      }
                  });
                }
              });
            }
          }
        }
      );
    });

    /**
     * hongyeon only
     * @name updateUser
     * @event
     */
    socket.on('updateUser', function(params, callback) {

      var param;
      if (typeof params == 'string') {
        param = JSON.parse( params );
      } else {
        param = params;
      }

      var err = serverUtils.validSocketParams(param, ['U', 'DT']);
      if (err) {
        if (callback) callback({ status: 'ERR-PARAM', message: err });
        return;
      }

      mongoPersister.updateActiveUser({
        A : socket.handshake.query.A,
        C : socket.handshake.query.C,
        U : param.U,
        DT : param.DT
      },function(err,user){
        if(!err){
          self.sessionManager.retrieveClient(
            socket.handshake.query.A,
            socket.handshake.query.C,
            param.U,
            function(res) {
              if( res ){
                var data = res;
                if (typeof res == 'string') {
                  data = JSON.parse( res );
                }

                for( var key in param.DT ){
                  data[key] = param.DT[key];
                }

                self.sessionManager.updateClient(
                  socket.handshake.query.A,
                  socket.handshake.query.C,
                  param.U,
                  JSON.stringify( data )
                );

                callback({
                  status: 'ok',
                  result: user
                });
              } else {
                self.sessionManager.updateClient(
                  socket.handshake.query.A,
                  socket.handshake.query.C,
                  param.U,
                  JSON.stringify( user )
                );

                callback({
                  status: 'ok',
                  result: user
                });
              }
            }
          );
        } else {
          callback({
            status: 'ERR-USER_EXIST',
            message: 'Not exist user'
          });
        }
      });
    });


    /**
     * 현재 channel의 연결을 닫는다.
     * @name disconnect
     * @event
     */
    socket.on('disconnect', self._channel_disconnect);

    /**
     * socket-stream을 이용하여 file을 upload한다.
     * @name file-upload
     * @event
     */
    ss(socket).on('file-upload', {highWaterMark: 64 * 1024}, function(stream, data, callback) {

      var uploadPath = path.join(
        self.options.home,
        self.options.upload || 'upload',
        socket.handshake.query.C
      );

      if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, 0766);

      var ext = (data.orgName) ? data.orgName.substring(data.orgName.lastIndexOf('.') + 1, data.orgName.length) : null;
      var fileName = data.name || shortId.generate();
      fileName = fileName.replace(/ /g,'');
      if(ext) fileName = fileName +'.'+ext;

      // file 저장 후 이벤트 발생시킨다.
      var dst = fs.createWriteStream(path.join(uploadPath, fileName));

      dst.on('close', function(r){

        // image type인 경우, imagemagick를 사용하여 150 x 150 사이즈로 변경한다.
        if(data.type == 'image'){

          console.log(path.join(uploadPath, fileName));

          var srcData = fs.readFileSync(path.join(uploadPath, fileName));

          //@todo check this
          //fs.readFile(path.join(uploadPath, fileName), function (err, srcData) {
          //  if (err) throw err;
            var resizedBuffer = imagemagick.convert({
                srcData: srcData,
                /*debug: 1,
                ignoreWarnings: 1, */
                width: 150,
                height: 150,
                resizeStyle: "aspectfit", // aspectfit:  keep aspect ratio, get maximum image that fits inside provided size
                quality: 80,
                format: 'JPEG'
            });

            fs.writeFile(path.join(uploadPath, 'T_'+fileName), resizedBuffer, 'binary', function (err) {
              if (err) throw err;
              callback({
                status: 'ok',
                result: {
                  channel: socket.handshake.query.C,
                  name: fileName,
                  tname: 'T_'+fileName
                }
              });
            });

          //});

        }else{
          callback({
            status: 'ok',
            result: {
              channel: socket.handshake.query.C,
              name: fileName
            }
          });
        }

      });
      stream.pipe(dst);
    });

    // additional socket event.
    for (var key in self.methods.CHANNEL_SOCKET) {
      socket.on(key, self.methods.CHANNEL_SOCKET[key]);
    }

  });


  this.io.of('/admin').use(function(socket, callback) {

    if (self.options.admin && self.options.admin.token) {
      var handshakeData = socket.request;
      if ( handshakeData._query.token == self.options.admin.token ){
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

      result.name   = self.serverName;
      result.host   = self.options.host;
      result.uptime = process.uptime();
      result.memory = process.memoryUsage();
        // rss: Resident set size
        // heapTotal: Heap size sampled immediately after a full garbage collection,
        // heapUsed: Current heap size

      result.client = {
        socket : Object.keys(self.io.of('/channel').connected).length,
        channel : Object.keys(self.channels).length,
        bigchannel : Object.keys(self.multiChannels).length,
      };

      callback(result);
    });

  });

  /**
   * sessionSubscriber로 넘어오는 `message` event를 처리한다.
   * @name message
   * @event
   */
  self.sessionSubscriber.on('_message', function(receivedData) {

    // #### message process for session socket servers
    if (receivedData._type == 'message') {

      // socket 연결 여부를 확인한다.
      var _socketId = self.socketIds[receivedData.A + '_' + receivedData.U + '_' + receivedData.D];
      var _socket = self.io.of('/session').connected[_socketId];

      // Session socket이 연결되어 있는 경우는, session socket에 `NOTIFICATION` 메시지를 보낸다.
      if (_socket && _socket.id != undefined) {

        _socket.emit('_event', {
          event: 'NOTIFICATION',
          NM: receivedData.NM, // name
          DT: receivedData.DT, // data
          C : receivedData.C,  // channel
          TS: receivedData.TS  // timestamp
        });

      } else { // application was OFF.
        // Session socket이 연결되어 있지 않으면, mobile NotiID가 존재하는 지 확인
        if (receivedData.N) { // noti id is existed.

          // GCM이 활성화되어 있으면, GCM 메시지를 전송한다.
          if (gcmObject[receivedData.A].sender != undefined) {
            var gcmIds = [];
            gcmIds.push(receivedData.N);
            var data = null;
            if (typeof receivedData.DT == 'string') {
              data = {
                'title': receivedData.DT,
                'message': receivedData.DT
              };
            } else {
              data = receivedData.DT;
              data.timestamp = receivedData.TS; // @ TODO 'timesteamp' is the reserved keyword from GCM ?
            }
            gcmObject[receivedData.A].send(gcmIds, data);
          }

          //@todo APN implementation
        } else {
          // This is not support for Mobile Notification. Do Nothing !!!
        }
      }

      // #### sending message from session server API
    } else if (receivedData._type == 'send') {

      // session ID가 존재하면 현재 channel에 전송함.
      if (receivedData.SS) {
        self._sendPrivate(null, receivedData.SS, receivedData.NM, receivedData.DT);
      } else {
        self._send(receivedData.A, receivedData.C, receivedData.NM, receivedData.DT);
      }

      // ### for channel socket server
    } else if (receivedData._type == 'send-once') {

      if (receivedData.SS) {
        self._sendPrivate(null, receivedData.SS, receivedData.NM, receivedData.DT);
      }else{
        self._sendOnce(receivedData.A, receivedData.C, receivedData.NM, receivedData.DT);
      }

      // ### for channel socket server
    } else if (receivedData._type == 'createChannel') {

      self.channels[receivedData.A + '^' + receivedData.C] = receivedData.US; // @ TODO check !! --> data.users;

      // ### for channel socket server
    } else if (receivedData._type == 'addChannelUser') {

      if (self.channels[receivedData.A + '^' + receivedData.C]) {
        for (var i = 0; i < receivedData.US.length; i++) {
          self.channels[receivedData.A + '^' + receivedData.C].push(receivedData.US[i]);
        }
      }

      // ### for channel socket server
    } else if (receivedData._type == 'exitChannelUser') {

      var tmpChannels = self.channels[receivedData.A + '^' + receivedData.C];

      for (var j = 0; j < tmpChannels.length; j++) {
        if (tmpChannels[j] == receivedData.U) {
          tmpChannels.splice(j, 1);
          j--;
        }
      }
    } else if (receivedData._type == 'add-channel-server') {

      if(self.channels[receivedData.A + '^' + receivedData.C]){

        var _mc = self.multiChannels[receivedData.A + '^' + receivedData.C];

        if(!_mc){
          self.multiChannels[receivedData.A + '^' + receivedData.C] = [receivedData.S];
        }else{
          if(_mc.indexOf(receivedData.S) == -1) self.multiChannels[receivedData.A + '^' + receivedData.C].push(receivedData.S);
        }
      }

    } else if (receivedData._type == 'del-channel-server') {

      var _mcd = self.multiChannels[receivedData.A + '^' + receivedData.C];
      if(_mcd){
        self.multiChannels[receivedData.A + '^' + receivedData.C].splice(_mcd.indexOf(receivedData.S), 1);
        if(_mcd.length == 0) delete self.multiChannels[receivedData.A + '^' + receivedData.C];
      }

    }
  });


  if (this.options.type && this.options.type == 'PROXY') {
    require('../routes/routes')(self.server, self.nodeManager);
  }

  http.listen(this.options.port, function() {
    self.emit('started', self.options.host, self.options.port);
  });

};

/**
 * socketId 가 연결되어 있으면, 현재 서버에서 바로 전송한다.
 * @name _sendPrivate
 * @function
 * @param {string} _socketId - socket id
 * @param {string} _name - event name
 * @param {string} _data - data to send
 * @param {callback} callback - 전송 후 수행할 callback function
 */
ChannelServer.prototype._sendPrivate = function(_server, _socketId, _name, _data, callback) {

  console.log(_name, _data, _socketId);

  if(_server){

    self.sessionManager.publish( _server, {
      _type: 'send-once',
      SS: _socketId,
      NM: _name,
      DT: _data
    });

  } else {
    var _socket = this.io.of('/channel').connected[_socketId];
    if (_socket && _socket.id != undefined) {
      var currentTimestamp = Date.now();
      _data.TS = currentTimestamp;
      _socket.emit(_name, _data);
    }
  }

};

ChannelServer.prototype._sendOnce = function(_app, _channel, _name, _data, callback) {
  var _room = _app + '^' + _channel;
  var currentTimestamp = Date.now();
  if (this.io.of('/channel').in(_room) != undefined) {
    _data.C = _channel;
    _data.TS = currentTimestamp;
    this.io.of('/channel').in(_room).emit(_name, _data);
  }
};

/**
 * socketId 가 연결되어 있으면, 현재 서버에서 바로 전송한다.
 * @name _send
 * @function
 * @param {string} _app - application id
 * @param {string} _channel - channel id
 * @param {string} _name - event name
 * @param {string} _data - data to send
 * @param {callback} callback - 전송 후 수행할 callback function
 */
ChannelServer.prototype._send = function(_app, _channel, _name, _data, callback) {
  var self = this;
  var _room = _app + '^' + _channel;
  var currentTimestamp = Date.now();
  if (this.io.of('/channel').in(_room) != undefined) {
    _data.C = _channel;
    _data.TS = currentTimestamp;
    this.io.of('/channel').in(_room).emit(_name, _data);
  }

  var _m = self.multiChannels[_room];
  if( _m){
    var _ml = _m.length;
    for (var i = 0; i < _ml; i++) {

      self.sessionManager.publish( _m[i], {
        _type: 'send-once',
        A : _app,
        C : _channel,
        NM: _name,
        DT: _data
      });

    }
  }

  // @TODO 단일메시지 통신에서는 필요 없으나, 향후 메신져 개발에는 필요한 로직. (향후 검토 예정)

  var _tmpSockets = [];

  var _socketIds = self.io.of('/channel').adapter.rooms[_room];
  if (_socketIds) {
    for (var id in _socketIds) {
      _tmpSockets.push(self.io.of('/channel').connected[id]);
    }
  }

  //console.log('[MESSAGE ('+_channel+')]  : ' + _tmpSockets.length);

  /***********************************************************************************
  // Using the mongodb aggregation or somthing efficient !!!!
  // And by forked process !!!

  var _tmpIds = {};
  for (var i = 0; i < _tmpSockets.length; i++) {
    _tmpIds[_tmpSockets[i]._userId + "^" + _tmpSockets[i]._deviceId] = _tmpSockets[i].id;
  }

  var users = this.channels[_app + '^' + _channel];
  var _users = [];
  for (var x = 0; x < users.length; x++) {

    if (!_tmpIds[users[x].U + "^" + users[x].D]) {

      _users.push({
        U: users[x].U,
        D: users[x].D
      });

      var serverNode = self.nodeManager.getServerNode(_app + users[x].U);

      console.log('Message to SessionServer - ' + users[x].U + " - " + users[x].D);
      self.sessionManager.publish(
      serverNode.name, {
        _type: 'message',
        A: _app,
        C: _channel,
        U: users[x].U,
        D: users[x].D,
        N: users[x].N,
        NM: _name,
        DT: _data,
        TS: currentTimestamp
      });
    }
  }

  if (_users.length > 0) {
    mongoPersister.storeMessages({
      A : _app,
      C : _channel,
      NM: _name,
      DT: _data,
      US: _users,
      TS: currentTimestamp
    }, function(err) {
      if (err) {
        console.log(err);
        if (callback) callback(err);
      }
      else {
        if (callback) callback(null);
      }
    });
  } else {
    if (callback) callback(null);
  }
  */

};

ChannelServer.prototype.session_on = function(_event, _fn) {
  this.methods.SESSION_SOCKET[_event] = _fn;
};

ChannelServer.prototype.channel_on = function(_event, _fn) {
  this.methods.CHANNEL_SOCKET[_event] = _fn;
};

ChannelServer.prototype.ping = function(msg) {
  console.log(this.proc);
  return 'pong '+ (msg?msg:'');
};

ChannelServer.prototype.send = function(_this, params, callback) {
  return this._channel_send(params, callback, _this);
};

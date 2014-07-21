var events   = require('events'),
    //compress = require('compression')(),
    util     = require('util'),
    async    = require('async'),
    path     = require('path'),
    fs       = require('fs'),
    shortId  = require('shortid'),
    send     = require('send'), // https://github.com/visionmedia/send
    imagemagick = require('imagemagick-native'), // https://github.com/mash/node-imagemagick-native

    serverUtils        = require('./utils'),
    database           = require('../mongodb-persister/database'),
    NodeManager        = require('../node-manager/node-manager.js').NodeManager,
    SessionManager     = require('../session-manager/session-manager.js').SessionManager,
    SessionSubscriber  = require('../session-manager/session-subscriber.js').SessionSubscriber,
    mongoPersister     = require('../mongodb-persister/mongoPersister'),
    Gcm                = require('../mobile/gcm').Gcm;

var gcmObject = {};

var ChannelServer = exports.ChannelServer = function(options) {
  for (var key in options.apps) {
    var appId = options.apps[key].id;
    var gcmApiKey = options.apps[key].notification.gcm.apiKey;
    if (gcmApiKey != '') {
      Gcm = new Gcm(gcmApiKey);
      gcmObject[appId] = Gcm;
    }
  }
  if (!options || !options.port) {
    throw new Error('Both `options` and `options.port` are required.');
  }

  var self = this;

  if (!options.host) {
    options.host = options.host ? options.host : serverUtils.getIP();
  }

  var _killProcess = function() {
    self.nodeManager.removeServerNode(options.host, options.port, process.exit);
  };

  process.on('SIGINT', _killProcess).on('SIGTERM', _killProcess); // ctrl+c , kill process(except -9)

  events.EventEmitter.call(this);

  this.options = options;

  // inner storage for socket ids.
  this.socketIds = {};

  // inner storage for channels
  this.channels = {}; // {U, D, N}


  this.methods = {
    SESSION_SOCKET: {},
    CHANNEL_SOCKET: {}
  };


  try {

    async.parallel(
    [

    // 1. mongodb connection
    function(callback) {

      database.config(
      self.options && self.options.mongodb && self.options.mongodb.address ? self.options.mongodb.address : '', 'xpush',
      self.options.mongodb && self.options.mongodb && self.options.mongodb.options ? self.options.mongodb.options : undefined,
      function(err, message) {
        console.log(err);
        console.log(message);
        if (!err) console.info('  - Mongodb is connected');
        callback(err);
      });

    },

    // 2.node-manager
    function(callback) {

      self.nodeManager = new NodeManager(
      self.options && self.options.zookeeper && self.options.zookeeper.address ? self.options.zookeeper.address : '',
      true, //false,   // In case of Channel Server, do not watch the status of server nodes.
      function(err) {
        if (!err) {
          console.info('  - Zookeeper is connected');
          self.nodeManager.addServerNode(self.options.host, self.options.port, function(err, path) {
            if (!err) console.info('  - Server Node is created : ' + path);

            var serverName = path.substring(path.lastIndexOf('/') + 1, path.length);
            self.serverName = serverName.split('^')[0];

            callback(err);
          });
        }
        else {
          callback(err);
        }
      });

    },

    // 3. session-manager
    function(callback) {

      self.sessionManager = new SessionManager(
      self.options && self.options.redis && self.options.redis.address ? self.options.redis.address : '',

      function(err) {
        if (!err) console.info('  - Redis is connected');
        callback(err);
      });
    }],

    // And then, STARTUP !!
    function(err, results) {

      if (!err) {

        self.sessionSubscriber = new SessionSubscriber(
        self.options && self.options.redis && self.options.redis.address ? self.options.redis.address : '', self.serverName,

        function(err) {
          if (!err) console.info('  - Redis Substriber is connected');
          if (!err) self.startup();

        });
      }


    });

  }
  catch (err) {
    console.log(err);
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
        /*pid: process.pid,
        memory: process.memoryUsage(),
        uptime: process.uptime(),*/
        message: 'pong'
      }
    });

  });

  // file download via HTTP GET
  app.get('/download/:app/:channel/:userId/:socketId/:filename', function(req, res) {

    var isConnected = false;
    var _users = self.channels[req.params.app + '^' + req.params.channel];
    for (var i=0; i<_users.length; i++){
      if(_users[i].U == req.params.userId){
        if(self.io.of('/channel').connected[req.params.socketId]){
          isConnected = true;
          break;
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
        .on('headers', function (res, path, stat) {
          res.setHeader('Content-Disposition', 'attachment');
        })
        .pipe(res);

    }else{

      res.statusCode = 404;
      res.end('大道無門');

    }


  });

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
      }
      else {
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

    self.socketIds[
      socket.handshake.query.A + '_' + socket.handshake.query.U + '_' + socket.handshake.query.D
    ] = socket.id;

    console.log('socketIds key = ' + socket.handshake.query.A + '_' + socket.handshake.query.U + '_' + socket.handshake.query.D);
    console.log('== session socket id =='.red, socket.id.red);

    // params : C, U, DT
    socket.on('channel-create', function(params, callback) {

      if (!params.U || params.U.length === 0) {
        callback({
          status: 'ERR-PARAM',
          message: 'Channel have to include user(s).'
        });
        return;
      }

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
          self.getChannelServer(socket.handshake.query.A, params.C, function(serverInfo) {
            self.sessionManager.publish(
            serverInfo.name, {
              _type: 'createChannel', /* IMPORTANT */
              A : socket.handshake.query.A,
              C : params.C,
              US: data.US
            });
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

    //
    socket.on('channel-list', function(callback) {
      console.log('channel-list');
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

        }
        else {
          if (callback) callback({
            status: 'ok',
            result: channels
          });
        }
      });
    });

    // params : C
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

    // params : C, U, DT
    /*
    socket.on('channel-join', function(params, callback) {

      var err = serverUtils.validSocketParams(params, ['C', 'U']);
      if (err) {
        if (callback) callback({
          status: 'ERR-PARAM',
          message: err
        });
        return;
      }

      mongoPersister.addChannelUser({
        A : socket.handshake.query.A,
        C : params.C,
        U : socket.handshake.query.U,
        DT: params.DT
      }, function(err, users) {
        if (err) {
          if (callback) callback({
            status: 'ERR-INTERNAL',
            message: err
          });
        } else {

          self.getChannelServer(socket.handshake.query.A, params.C, function(serverInfo) {

            self.sessionManager.publish( serverInfo.name, {
              _type: 'addChannelUser',
              // IMPORTANT
              A: socket.handshake.query.A,
              C: params.C,
              US: US
            });

          });

          //for(var i=0; i<users.length; i++){
          //  self.channels[socket.handshake._app+'^'+params.channel].push(users[i]);
          //}

          if (callback) callback({
            status: 'ok',
            result: users
          });
        }
      });

    });
    */

    // params : C
    socket.on('channel-exit', function(params, callback) {

      var err = serverUtils.validSocketParams(params, ['C']);
      if (err) {
        if (callback) callback({
          status: 'ERR-PARAM',
          message: err
        });
        return;
      }

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

          // TODO pull channels users and delete channels if user is not existed.

          self.getChannelServer(socket.handshake.query.A, params.C, function(serverInfo) {
            self.sessionManager.publish(
            serverInfo.name, {
              _type: 'exitChannelUser',
              /* IMPORTANT */
              A: socket.handshake.query.A,
              C: params.C,
              U: socket.handshake.query.U
            });
          });

          if (callback) callback({
            status: 'ok',
            result: channels
          });
        }
      });

    });

    // params : keys, values
    socket.on('user-list', function(params, callback) {
      mongoPersister.searchUser(
      socket.handshake.query.A,
      params.keys, // optional
      params.values, // optional
      function(err, users) {
        if (err) {
          if (callback) callback({
            status: 'ERR-INTERNAL',
            message: err
          });
        } else {
          if (callback) callback({
            status: 'ok',
            result: users
          });
        }
      });

    });

    // @ TODO using redis hscan by notdol.
    // params : key
    socket.on('channel-list-active', function(params, callback) {
      var appId = socket.handshake.query.A;
      var subKeyPattern = params.key;
      /*
      if (params.key != null && params.key != undefined) {
        appId = appId + ":" + params.key;
      }
      */
      self.sessionManager.retrieveChannelList(appId,subKeyPattern,function(err,results){
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
      }

      );
    });

    // params : GR
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

    // params : U, GR
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

    // params : U, GR
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

    socket.on('disconnect', function() {
      delete self.socketIds[socket.handshake.query.A + '_' + socket.handshake.query.U + '_' + socket.handshake.query.D];
    });

    // additional socket event.
    for (var key in self.methods.SESSION_SOCKET) {
      socket.on(key, self.methods.SESSION_SOCKET[key]);
    }

  });


  this.io.of('/channel').use(function(socket, callback) {

    var handshakeData = socket.request;

    // TODO
    // Check the channel is available (Existed? ) ?
    // or this is wasted ?
    var _app       = handshakeData._query.A;
    var _channel   = handshakeData._query.C;
    var _server    = handshakeData._query.S;
    var _userId    = handshakeData._query.U;
    var _deviceId  = handshakeData._query.D;

    // #### CHANNEL_ONLY : using only channel namespace socket.
    var _mode = '';
    if (handshakeData._query.MD) _mode = handshakeData._query.MD;


    if (!_app || !_channel || !_server) {
      callback('Parameter is not corrected. (A, C, S) ', false);
      return;
    }

    if (_mode == 'CHANNEL_ONLY') { // without session socket Server.

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

  }).on('connection', function(socket) {

    var _room = socket.handshake.query.A + '^' + socket.handshake.query.C;
    console.log('channel socket connection : '+ socket.id +' / '+_room);

    socket.join(_room);

    socket._userId = socket.handshake.query.U;
    socket._deviceId = socket.handshake.query.D;

    var _count_of_this_channel = Object.keys(socket.adapter.rooms[_room]).length;

    self.sessionManager.update(
      socket.handshake.query.A,
      socket.handshake.query.C,
      socket.handshake.query.S,
      _count_of_this_channel);

    self.emit('channel', { // @ TODO is it using ? must be '_event' ?
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

    socket.broadcast.to(_room).emit('_event', _msgObj);
    socket.emit('_event', _msgObj);

    // params : U, DT
    socket.on('join', function(params, callback) {

      mongoPersister.addChannelUser({
        A : socket.handshake.query.A,
        C : socket.handshake.query.C,
        U : params.U,
        DT: params.DT
      }, function(err, datas) {

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


    // params : NM, DT, SS
    socket.on('send', function(params, callback) {
      var err = serverUtils.validSocketParams(params, ['NM', 'DT']);
      if (err) {
        if (callback) callback({ status: 'ERR-PARAM', message: err });
        return;
      }

      if (params.SS) {
        self.sendPrivate(
          params.SS, // socketId
          params.NM,
          params.DT);

      } else {
        self.send(
          socket.handshake.query.A,
          socket.handshake.query.C,
          params.NM,
          params.DT,
          callback);
      }

    });

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
        }
        else {
          if (callback) callback({
            status: 'ok',
            result: data
          });
        }
      }

      );

    });

    socket.on('message-received', function(callback) {
      mongoPersister.removeUnReadMessages({
        A: socket.handshake.query.A,
        C: '',
        U: socket.handshake.query.U,
        D: socket.handshake.query.D
      }, function(err, data) {
        if (err) {
          if (callback) callback({ status: 'ERR-INTERNAL', message: err });
          return;
        }
        else {

          if (callback) callback({
            status: 'ok',
            result: data
          });

        }
      }

      );
    });

    socket.on('disconnect', function() {

      var _a = socket.handshake.query.A;
      var _c = socket.handshake.query.C;
      var _u = socket.handshake.query.U;

      var _room = _a + '^' + _c;

      socket.leave(_room);

      var _count_of_this_channel = 0;
      if (socket.adapter.rooms[_room]) {
        _count_of_this_channel = Object.keys(socket.adapter.rooms[_room]).length;
      }

      if (_count_of_this_channel == 0) {
        delete self.channels[_a + '^' + _c];

      }
      else {

        socket.broadcast.to(_room).emit('_event', {
          //self.io.of('/channel').in(_room).emit('_event', {
          event: 'DISCONNECT',
          count: _count_of_this_channel,
          A: _a,
          C: _c,
          U: _u
        });

      }

      self.sessionManager.update(_a, _c, socket.handshake.query.S, _count_of_this_channel);

      self.emit('channel', { // @ TODO is it using ? channel is must be '_event'
        'event': 'update',
        'count': _count_of_this_channel,
        'A': _a,
        'C': _c,
        'S': socket.handshake.query.S
      });

    });

    //file upload by socket-stream
    ss(socket).on('file-upload', {highWaterMark: 64 * 1024}, function(stream, data, callback) {

      var uploadPath = path.join(
        self.options.home,
        self.options.upload || 'upload',
        socket.handshake.query.C
      );

      if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, 0766);

      var fileName = data.name || shortId.generate();
      fileName = fileName.replace(/ /g,'');

      var dst = fs.createWriteStream(path.join(uploadPath, fileName));

      dst.on('close', function(r){

        // is image file ?
        if(data.type == 'image'){

          console.log(path.join(uploadPath, fileName));

          var srcData = fs.readFileSync(path.join(uploadPath, fileName));

          //fs.readFile(path.join(uploadPath, fileName), function (err, srcData) {
          //  if (err) throw err;
            var resizedBuffer = imagemagick.convert({
                srcData: srcData,
                /*debug: 1,
                ignoreWarnings: 1, */
                width: 200,
                height: 200,
                resizeStyle: "aspectfit", // aspectfit:  keep aspect ratio, get maximum image that fits inside provided size
                quality: 80,
                format: 'JPEG'
            });

            fs.writeFile(path.join(uploadPath, fileName+'_TN.png'), resizedBuffer, 'binary', function (err) {
              if (err) throw err;
              callback({
                status: 'ok',
                result: {
                  channel: socket.handshake.query.C,
                  name: fileName
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

  // message from session server
  self.sessionSubscriber.on('message', function(receivedData) {

    // #### message process for session socket servers
    if (receivedData._type == 'message') {

      var _socketId = self.socketIds[receivedData.A + '_' + receivedData.U + '_' + receivedData.D];
      var _socket = self.io.of('/session').connected[_socketId];

      if (_socket && _socket.id != undefined) { // applicacation is alive. Session socket is connected !!

        _socket.emit('_event', {
          event: 'NOTIFICATION',
          NM: receivedData.NM, // name
          DT: receivedData.DT, // data
          C : receivedData.C,  // channel
          TS: receivedData.TS  // timestamp
        });

      }
      else { // application was OFF.
        if (receivedData.N) { // noti id is existed.
          // existed mobile notification token ?
          // TODO implements GCM / APN process !!!!!
          if (gcmObject[receivedData.A].sender != undefined) {
            var gcmIds = [];
            gcmIds.push(receivedData.N);
            var data = null;
            if (typeof receivedData.DT == 'string') {
              data = {
                'title': receivedData.DT,
                'message': receivedData.DT
              };
            }
            else {
              data = receivedData.DT;
              data.timestamp = receivedData.TS; // @ TODO 'timesteamp' is the reserved keyword from GCM ?
            }
            gcmObject[receivedData.A].send(gcmIds, data);
          }
        } else {

          // This is not support for Mobile Notification. Do Nothing !!!
        }
      }


      // #### sending message from session server API
    }
    else if (receivedData._type == 'send') {

      if (receivedData.SS) {
        self.sendPrivate(receivedData.SS, receivedData.NM, receivedData.DT);
      } else {
        self.send(receivedData.A, receivedData.C, receivedData.NM, receivedData.DT);
      }

      // ### for channel socket server
    }
    else if (receivedData._type == 'createChannel') {

      self.channels[receivedData.A + '^' + receivedData.C] = receivedData.US; // @ TODO check !! --> data.users;

      // ### for channel socket server
    }
    else if (receivedData._type == 'addChannelUser') {

      if (self.channels[receivedData.A + '^' + receivedData.C]) {
        for (var i = 0; i < receivedData.US.length; i++) {
          self.channels[receivedData.A + '^' + receivedData.C].push(receivedData.US[i]);
        }
      }

      // ### for channel socket server
    }
    else if (receivedData._type == 'exitChannelUser') {

      var tmpChannels = self.channels[receivedData.A + '^' + receivedData.C];

      for (var j = 0; j < tmpChannels.length; j++) {
        if (tmpChannels[j] == receivedData.U) {
          tmpChannels.splice(j, 1);
          j--;
        }
      }

    }

  });


  if (this.options.type && this.options.type == 'PROXY') {
    require('../routes/routes')(self.server, self.nodeManager);
  }

  http.listen(this.options.port, function() {
    self.emit('connected', self.options.host, self.options.port);
  });
  /*  this.server.listen(this.options.port, function () {
    self.emit('connected', self.server.url, self.options.port);
  }); */

};

ChannelServer.prototype.sendPrivate = function(_socketId, _name, _data, callback) {

  console.log(_name, _data, _socketId);
  var _socket = this.io.of('/channel').connected[_socketId];
  if (_socket && _socket.id != undefined) {
    _socket.emit(_name, _data);
  }
  else {

  }

};

ChannelServer.prototype.send = function(_app, _channel, _name, _data, callback) {
  var self = this;
  var _room = _app + '^' + _channel;
  var currentTimestamp = Date.now();
  if (this.io.of('/channel'). in (_room) != undefined) {
    _data.C = _channel;
    _data.TS = currentTimestamp;
    this.io.of('/channel'). in (_room).emit(_name, _data);
  }

  // TODO
  // Using the mongodb aggregation or somthing efficient !!!!
  // And by forked process !!!

  var _tmpSockets = [];
  var _tmpIds = {};

  var _socketIds = self.io.of('/channel').adapter.rooms[_room];
  if (_socketIds) {
    for (var id in _socketIds) {
      _tmpSockets.push(self.io.of('/channel').connected[id]);
    }
  }

  /*
  var _tmpSockets = Object.keys(self.io.of('/channel').adapter.rooms[_room]); // self.io.of('/channel').clients(_room);
  var _tmpIds     = {};
*/
  console.log('socket count in this channel : ' + _tmpSockets.length);

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
        /* IMPORTANT */
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
  }
  else {
    if (callback) callback(null);
  }


  /*
  this.message_process.send({
    action: 'notification',
    app: _app,
    channel: _channel,
    data: _data
  });
  */

};


ChannelServer.prototype.getChannelServer = function(_app, _channel, fn) {

  var self = this;

  this.sessionManager.retrieve(_app, _channel, function(server) {

    var serverInfo = '';
    if (server) {
      serverInfo = self.nodeManager.getServerNodeByName(server);

      if (!serverInfo) { // remove the server data from redis session storage.
        self.sessionManager.remove(_app, _channel);
        self.emit('channel', {
          'event': 'remove',
          'app': _app,
          'channel': _channel
        });

      }
    }

    // TODO In the case Not Existed serverNode Object !!

    var serverNode = {};
    if (!serverInfo) {

      serverNode = self.nodeManager.getServerNode(_channel);

      if (!serverNode) {
        return fn();
      }
    }

    fn({
      name: serverNode.name,
      url: serverUtils.setHttpProtocal(serverNode.url)
    });

  });
};


ChannelServer.prototype.session_on = function(_event, _fn) {
  this.methods.SESSION_SOCKET[_event] = _fn;
};

ChannelServer.prototype.channel_on = function(_event, _fn) {
  this.methods.CHANNEL_SOCKET[_event] = _fn;
};

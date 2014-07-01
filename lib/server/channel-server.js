var events  = require('events'),
    express = require('express'),
    compress = require('compression')(),
    util    = require('util'),
    async   = require('async'),

    serverUtils       = require('./utils'),
    database          = require('../mongodb-persister/database'),
    NodeManager       = require('../node-manager/node-manager.js').NodeManager,
    SessionManager    = require('../session-manager/session-manager.js').SessionManager,
    SessionSubscriber = require('../session-manager/session-subscriber.js').SessionSubscriber,
    mongoPersister    = require('../mongodb-persister/mongoPersister');

var Gcm = require('../mobile/gcm').Gcm;
var gcmObject = {};

var ChannelServer = exports.ChannelServer = function (options) {
  for( var key in options.apps ){
    var appId = options.apps[key].id;
    var gcmApiKey = options.apps[key].notification.gcm.apiKey;
    if ( gcmApiKey != '' ){
      Gcm = new Gcm( gcmApiKey );
      gcmObject[appId] = Gcm;
    }
  }
  if (!options || !options.port) {
    throw new Error('Both `options` and `options.port` are required.');
  }

  var self  = this;

  if (!options.host){
    options.host = options.host?options.host: serverUtils.getIP();
  }

  var _killProcess = function(){
    self.nodeManager.removeServerNode(options.host, options.port, process.exit);
  };

  process.on('SIGINT',_killProcess).on('SIGTERM',_killProcess); // ctrl+c , kill process(except -9)

  events.EventEmitter.call(this);

  this.options = options;

  // inner storage for socket ids.
  this.socketIds = {};

  // inner storage for channels
  this.channels = {};


  this.methods = {
    SESSION_SOCKET: {},
    CHANNEL_SOCKET: {}
  };


  try {

    console.log('\n');
    async.parallel(
      [

        // 1. mongodb connection
        function(callback){

          database.config(
            self.options && self.options.mongodb && self.options.mongodb.address ? self.options.mongodb.address : '',
            'xpush',
            function (err, message) {
              if(!err) console.info('  - Mongodb is connected');
              callback(err);
            }
          );

        },

        // 2.node-manager
        function(callback){

          self.nodeManager = new NodeManager(
            self.options && self.options.zookeeper && self.options.zookeeper.address ? self.options.zookeeper.address : '',
            true, //false,   // In case of Channel Server, do not watch the status of server nodes.
            function (err) {
              if(!err){
                console.info('  - Zookeeper is connected');
                self.nodeManager.addServerNode(self.options.host, self.options.port, function (err, path) {
                  if(!err)console.info('  - Server Node is created : ' + path);

                  var serverName = path.substring(path.lastIndexOf('/')+1, path.length);
                  self.serverName = serverName.split('^')[0];

                  callback(err);
                });
              }else{
                callback(err);
              }
            }
          );

        },

        // 3. session-manager
        function(callback){

          self.sessionManager = new SessionManager(
            self.options && self.options.redis && self.options.redis.address ? self.options.redis.address : '',
            function (err) {
              if(!err) console.info('  - Redis is connected');
              callback(err);
            }
          );
        }
      ],

      // And then, STARTUP !!
      function(err, results){

        if(!err) {

          self.sessionSubscriber = new SessionSubscriber(
            self.options && self.options.redis && self.options.redis.address ? self.options.redis.address : '', self.serverName,
            function (err) {
              if(!err) console.info('  - Redis Substriber is connected');
              if(!err) self.startup();

            }
          );
        }


      }
    );

  } catch(err) {
    console.log(err);
  }

};

util.inherits(ChannelServer, events.EventEmitter);

ChannelServer.prototype.startup = function () {

  var self = this;


  var app  = require('express')();
  var http = require('http').Server(app);
  this.io  = require('socket.io')(http);

  app.get('/status/ping', function (req, res) {
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

  this.io.of('/session').use(function (socket, callback) {

    var handshakeData = socket.request;
    var _app      = handshakeData._query.app;
    var _userId   = handshakeData._query.userId;
    var _deviceId = handshakeData._query.deviceId;
    var _token    = handshakeData._query.token;

    if( !_app || !_userId || !_token || !_deviceId ) {
      next(new Error('Parameter is not corrected. (app, userId, deviceId, token)'));
      return;
    }

    mongoPersister.retrieveUser( _app, _userId, _deviceId, function (err, user) {

      if(err) {
        callback(err, false);
        return;
      }

      if(!user) {
        callback('User is not existed.', false);
        return;
      }else{
        if(user.token == _token){

          console.log('== session == '.red,_app.red,_userId.red,_deviceId.red);
          callback(null, true);

        }else{
          callback('Auth token is not available.', false);
        }
        return;
      }

    });

  }).on('connection', function (socket) {

    console.log("Authorization and connection".blue);

    self.socketIds[
      socket.handshake.query.app+'_'+
      socket.handshake.query.userId+'_'+
      socket.handshake.query.deviceId
    ] = socket.id;

    console.log('socketIds key = '+socket.handshake.query.app+'_'+
    socket.handshake.query.userId+'_'+
    socket.handshake.query.deviceId);
    console.log('== session socket id =='.red, socket.id.red);


    socket.on('channel-create', function (params, callback) {

      if(!params.users || params.users.length == 0){
        callback({
          status: 'error',
          message: 'Channel have to include users.'
        });
        return;
      }

      mongoPersister.createChannel(
        socket.handshake.query.app,
        params.channel,  // optional (can auto-generate !)
        params.users,
        function (err, data){

          if(err){
            console.log(err);
            if(callback) callback({
              status: 'error',
              message: err
            });

          }else{

            self.getChannelServer(socket.handshake.query.app, params.channel, function(serverInfo){
              self.sessionManager.publish(
                serverInfo.name,
                {
                  _type: 'createChannel', /* IMPORTANT */
                  app: _app,
                  channel: _channel,
                  users: data.users
                }
              );
            });

            // @TODO !!
            //self.channels[data.app+'^'+data.channel] = data.users;

            if(callback) callback({
              status: 'ok',
              result: data
            });

          }
        });
    });

    socket.on('channel-list', function (callback) {
      console.log('channel-list');
      mongoPersister.listChannel(
        socket.handshake.query.app,
        socket.handshake.query.userId,
        function (err, channels){
          if(err){
            console.log(err);
            if(callback) callback({
              status: 'error',
              message: err
            });

          }else{
            if(callback) callback({
              status: 'ok',
              result: channels
            });
          }
        });

    });

    socket.on('channel-join', function (params, callback) {

      var err = serverUtils.validSocketParams(params, ['channel','userId']);
      if(err){
        callback(err);
        return;
      }

      mongoPersister.addChannelUser(
        socket.handshake.query.app,
        params.channel,
        socket.handshake.query.userId,
        function (err, users){
          if(err){
            console.log(err);
            if(callback) callback({
              status: 'error',
              message: err
            });

          }else{

            self.getChannelServer(socket.handshake.query.app, params.channel, function(serverInfo){
              self.sessionManager.publish(
                serverInfo.name,
                {
                  _type: 'addChannelUser', /* IMPORTANT */
                  app: socket.handshake.query.app,
                  channel: params.channel,
                  users: users
                }
              );
            });

            //for(var i=0; i<users.length; i++){
            //  self.channels[socket.handshake._app+'^'+params.channel].push(users[i]);
            //}

            if(callback) callback({
              status: 'ok',
              result: users
            });
          }
        });

    });

    socket.on('channel-exit', function (params, callback) {

      var err = serverUtils.validSocketParams(params, ['channel']);
      if(err){
        callback(err);
        return;
      }

      mongoPersister.exitChannel(
        socket.handshake.query.app,
        params.channel,
        socket.handshake.query.userId,
        function (err, channels){
          if(err){
            console.log(err);
            if(callback) callback({
              status: 'error',
              message: err
            });

          }else{

            // TODO pull channels users and delete channels if user is not existed.

            self.getChannelServer(socket.handshake.query.app, params.channel, function(serverInfo){
              self.sessionManager.publish(
                serverInfo.name,
                {
                  _type   : 'exitChannelUser', /* IMPORTANT */
                  app     : socket.handshake.query.app,
                  channel : params.channel,
                  userId  : socket.handshake.query.userId
                }
              );
            });

            if(callback) callback({
              status: 'ok',
              result: channels
            });
          }
        });

    });

    socket.on('user-list', function (params, callback) {
      mongoPersister.searchUser(
        socket.handshake.query.app,
        params.keys,    // optional
        params.values,  // optional
        function (err, users){
          if(err){

            if(callback) callback({
              status: 'error',
              message: err
            });

          }else{
            if(callback) callback({
              status: 'ok',
              result: users
            });
          }
        });

    });

    socket.on('channel-list-active', function (params, callback) {
      var appId = socket.handshake.query.app;
      if( params.key != null && params.key != undefined ){
        appId = appId + ":" + params.key;
      }
      self.sessionManager.retrieveChannelList(appId, function (channels) {
        var results = [];

        for(var key in channels){
          var result = {};
          result[key] = JSON.parse(channels[key]);
          results.push(result);
        }

        if(callback) callback({
          status: 'ok',
          result: results
        });

      });
    });

    socket.on('message-unread', function (callback){
      mongoPersister.unReadMessages(
        socket.handshake.query.app,
        '',
        socket.handshake.query.userId,
        socket.handshake.query.deviceId,

        function(err, data){
          if(err){
            if(callback) callback({
              status: 'error',
              message: err
            });
            return;
          }else{

            if(callback) callback({
              status: 'ok',
              result: data
            });

          }
        }

      );

    });

    socket.on('group-list', function (params, callback) {
      var err = serverUtils.validSocketParams(params, ['groupId']);
      if(err){
        callback(err);
        return;
      }

      mongoPersister.listGroup(
        socket.handshake.query.app,
        params.groupId,
        function (err, users){
          if(err){

            if(callback) callback({
              status: 'error',
              message: err
            });

          }else{
            if(callback) callback({
              status: 'ok',
              result: users
            });
          }
        });

    });

    socket.on('group-add', function (params, callback) {
      var err = serverUtils.validSocketParams(params, ['userId', 'groupId']);
      if(err){
        callback(err);
        return;
      }

      mongoPersister.addGroupId(
        socket.handshake.query.app,
        params.userId,
        params.groupId,
        function (err){
          if(err){

            if(callback) callback({
              status: 'error',
              message: err
            });

          }else{
            if(callback) callback({
              status: 'ok'
            });
          }
        });

    });

    socket.on('group-remove', function (params, callback) {
      var err = serverUtils.validSocketParams(params, ['userId', 'groupId']);
      if(err){
        callback(err);
        return;
      }

      mongoPersister.removeGroupId(
        socket.handshake.query.app,
        params.userId,
        params.groupId,
        function (err){
          if(err){

            if(callback) callback({
              status: 'error',
              message: err
            });

          }else{
            if(callback) callback({
              status: 'ok'
            });
          }
        });

    });

/*
    socket.on('message-unread', function (params, callback){

      var err = serverUtils.validSocketParams(params, ['channel']);
      if(err){
        callback(err);
        return;
      }

      mongoPersister.unReadMessages(
        socket.handshake._app,
        params.channel,  // from parameters.
        socket.handshake._userId,
        socket.handshake._deviceId,

        function(err, data){
          if(err){
            console.log(err);
            if(callback) callback({
              status: 'error',
              message: err
            });
            return;
          }else{
            if(callback) callback({
              status: 'ok',
              result: data
            });
          }
        }

      );

    });
*/

    socket.on('disconnect', function () {

      delete self.socketIds[
        socket.handshake.query.app+'_'+
        socket.handshake.query.userId+'_'+
        socket.handshake.query.deviceId
      ];

    });

    // additional socket event.
    for(var key in self.methods.SESSION_SOCKET){
      socket.on(key, self.methods.SESSION_SOCKET[key]);
    }

  });


  this.io.of('/channel').use(function (socket, callback) {

    var handshakeData = socket.request;

    // TODO
    // Check the channel is available (Existed? ) ?
    // or this is wasted ?
    var _app      = handshakeData._query.app;
    var _channel  = handshakeData._query.channel;
    var _server   = handshakeData._query.server;
    var _userId   = handshakeData._query.userId;
    var _deviceId = handshakeData._query.deviceId;

    // #### CHANNEL_ONLY : using only channel namespace socket.
    var _mode     = '';
    if(handshakeData._query.mode) _mode = handshakeData._query.mode;


    if( !_app || !_channel || !_server ) {
      callback('Parameter is not corrected. (app, channel, server) ', false);
      return;
    }

    if(_mode == 'CHANNEL_ONLY'){ // without session socket Server.

      var _us = self.channels[_app+'^'+_channel];

      if(!_us){
        self.channels[_app+'^'+_channel] = [
          {
            userId: _userId,
            deviceId: _deviceId
          }
        ];
      }else{

        var _u = _us.filter(function(_uu){
          return (_uu.userId == _userId);
        });

        if(_u.length == 0){
          self.channels[_app+'^'+_channel].push({
            userId: _userId,
            deviceId: _deviceId
          });
        }

      }


      callback(null, true);

    }else{

      if(!self.channels[_app+'^'+_channel] ){

        mongoPersister.getChannel(_app, _channel, function (err, channel, msg) {
          if(err) {
            console.log(err);
            callback(err, false);
          }else{
            if(channel) {
              self.channels[_app+'^'+_channel] = channel.users;
              callback(null, true);
            }else{
              console.log('channel is not existed!'.red);
              callback(msg, false);
            }

          }
        });

      }else{

        callback(null, true);
      }
    }

  }).on('connection', function (socket) {


    console.log(socket.id);
    var _room = socket.handshake.query.app+'^'+socket.handshake.query.channel;

    socket.join(_room);

    socket._userId 		= socket.handshake.query.userId;
    socket._deviceId 	= socket.handshake.query.deviceId;

    var _count_of_this_channel = Object.keys(socket.adapter.rooms[_room]).length;

    self.sessionManager.update(
      socket.handshake.query.app,
      socket.handshake.query.channel,
      socket.handshake.query.server,
      _count_of_this_channel);

    self.emit('channel', {
      'event':   'update',
      'app':     socket.handshake.query.app,
      'channel': socket.handshake.query.channel,
      'server':  socket.handshake.query.server,
      'count':   _count_of_this_channel
    });

    var _msgObj = {
      event:  'CONNECTION',
      app:     socket.handshake.query.app,
      channel: socket.handshake.query.channel,
      userId:  socket.handshake.query.userId,
      count:   _count_of_this_channel
    };

    socket.broadcast.to(_room).emit('_event', _msgObj);
                        socket.emit('_event', _msgObj);

    socket.on('join', function (users, callback) {

      for (var i = 0; i < users.length; i++) {

        mongoPersister.addChannelUser(
          socket.handshake.query.app,
          socket.handshake.query.channel,
          users[i],
          function (err, datas) {

            for (var x = 0; x < datas.length; x++) {
              self.channels[socket.handshake.query.app+'^'+socket.handshake.query.channel].push({
                userId:   datas[i].userId,
                deviceId: datas[i].deviceId,
                notiId:   datas[i].notiId
              });
            }

          });
      }

      // @ TODO Async 로 수정해야 함.
      if(callback) callback({
        status: 'ok'
      });

    });


    socket.on('send', function (params, callback) {
      var err = serverUtils.validSocketParams(params, ['name', 'data']);
      if(err){
        console.log(err);
        if(callback) callback({
          status: 'error',
          message: err
        });
        return;
      }

      if(params.socketId){

        self.sendPrivate(
          params.soketId,
          params.name,
          params.data
        );

      }else{

        self.send(
          socket.handshake.query.app,
          socket.handshake.query.channel,
          params.name,
          params.data,
          callback);
      }

    });

    socket.on('message-unread', function (callback){
      mongoPersister.unReadMessages(
        socket.handshake.query.app,
        socket.handshake.query.channel,
        socket.handshake.query.userId,
        socket.handshake.query.deviceId,

        function(err, data){
          if(err){
            console.log(err);
            if(callback) callback({
              status: 'error',
              message: err
            });
            return;
          }else{
            if(callback) callback({
              status: 'ok',
              result: data
            });
          }
        }

      );

    });

    socket.on('message-received', function (callback){
      mongoPersister.removeUnReadMessages(
        socket.handshake.query.app,
        '',
        socket.handshake.query.userId,
        socket.handshake.query.deviceId,
        function(err, data){
          if(err){
            if(callback) callback({
              status: 'error',
              message: err
            });
            return;
          }else{

            if(callback) callback({
              status: 'ok',
              result: data
            });

          }
        }

      );
    });

    socket.on('disconnect', function () {

      var _a = socket.handshake.query.app;
      var _c = socket.handshake.query.channel;
      var _u = socket.handshake.query.userId;

      var _room = _a+'^'+_c;

      socket.leave(_room);

      var _count_of_this_channel = 0;
      if(socket.adapter.rooms[_room]){
        _count_of_this_channel = Object.keys(socket.adapter.rooms[_room]).length;
      }

      if(_count_of_this_channel == 0){
        delete self.channels[_a+'^'+_c];

      }else{

        socket.broadcast.to(_room).emit('_event', {
        //self.io.of('/channel').in(_room).emit('_event', {
          event:  'DISCONNECT',
          app:     _a,
          channel: _c,
          userId:  _u,
          count: _count_of_this_channel
        });

      }

      self.sessionManager.update(
        _a, _c, socket.handshake.query.server, _count_of_this_channel
      );

      self.emit('channel', {
        'event': 'update',
        'app': _a,
        'channel': _c,
        'server': socket.handshake.query.server,
        'count': _count_of_this_channel
      });

    });

    // additional socket event.
    for(var key in self.methods.CHANNEL_SOCKET){
      socket.on(key, self.methods.CHANNEL_SOCKET[key]);
    }


  });

  // message from session server
  self.sessionSubscriber.on('message', function(receivedData) {

    console.log('-------------');
    console.log(receivedData);

    // #### message process for session socket servers
    if(receivedData._type == 'message'){

      var _socketId = self.socketIds[
        receivedData.app+'_'+
        receivedData.userId+'_'+
        receivedData.deviceId
      ];

      var _socket = self.io.of('/session').connected[_socketId];

      console.log(_socket);
      //var _room = receivedData.app+'^'+receivedData.channel;
      //var _socket = self.io.of('/session').socket(_socketId);
      if(_socket && _socket.id != undefined ) { // applicacation is alive. Session socket is connected !!

        _socket.emit('_event', {
          event: 'NOTIFICATION',
          name: receivedData.name,
          data: receivedData.data,
          channel : receivedData.channel,
          timestamp : receivedData.timestamp
        });

      } else { // application was OFF.
        if(receivedData.notiId){
          // existed mobile notification token ?
          // TODO implements GCM / APN process !!!!!
          if( gcmObject[receivedData.app].sender != undefined ){
            var gcmIds = [];
            gcmIds.push( receivedData.notiId );
            var data = null;
            if( typeof receivedData.data == 'string' ){
              data = {'title':receivedData.data, 'message':receivedData.data};
            } else {
              data = receivedData.data;
              data.timestamp = receivedData.timestamp;
            }
            gcmObject[receivedData.app].send( gcmIds, data );
          }
        }else{

          // This is not support for Mobile Notification. Do Nothing !!!
        }
      }


    // #### sending message from session server API
    }else if(receivedData._type == 'send'){

      if(receivedData.socketId){
        self.sendPrivate(receivedData.socketId, receivedData.name, receivedData.data);
      }else{
        self.send(receivedData.app, receivedData.channel, receivedData.name, receivedData.data);
      }

    // ### for channel socket server
    }else if(receivedData._type == 'createChannel'){

      self.channels[receivedData.app+'^'+receivedData.channel] = data.users;

    // ### for channel socket server
    }else if(receivedData._type == 'addChannelUser'){

      if(self.channels[receivedData.app+'^'+receivedData.channel]) {
        for(var i=0; i<receivedData.users.length; i++){
          self.channels[receivedData.app+'^'+receivedData.channel].push(receivedData.users[i]);
        }
      }

    // ### for channel socket server
    }else if(receivedData._type == 'exitChannelUser'){

        var tmpChannels = self.channels[receivedData.app+'^'+receivedData.channel];

        for (var j = 0; j < tmpChannels.length; j++) {
          if (tmpChannels[j] == receivedData.userId) {
            tmpChannels.splice(j, 1);
            j--;
          }
        }

    }

  });


  if(this.options.type && this.options.type == 'PROXY'){
    require('../routes/routes')(self.server, self.nodeManager);
  }

  http.listen(this.options.port, function(){
    self.emit('connected', self.options.host, self.options.port);
  });
/*  this.server.listen(this.options.port, function () {
    self.emit('connected', self.server.url, self.options.port);
  }); */

};

ChannelServer.prototype.sendPrivate = function (_socketId, _name, _data, callback) {

  console.log(_name, _data, _socketId);
  var _socket = this.io.of('/channel').connected[_socketId];
  if(_socket && _socket.id != undefined){
    _socket.emit(_name, _data);
  }else{

  }

};

ChannelServer.prototype.send = function (_app, _channel, _name, _data, callback) {
  var self = this;
  var _room = _app + '^' + _channel;
  if(this.io.of('/channel').in(_room) != undefined){
    _data.channel = _channel;
    this.io.of('/channel').in(_room).emit(_name, _data);
  }

  // TODO
  // Using the mongodb aggregation or somthing efficient !!!!
  // And by forked process !!!

  var _tmpSockets = Object.keys(self.io.of('/channel').adapter.rooms[_room]); // self.io.of('/channel').clients(_room);
  var _tmpIds     = {};

  console.log(_tmpSockets.length);

  for(var i=0; i<_tmpSockets.length; i++){
    _tmpIds[_tmpSockets[i]._userId+"^"+_tmpSockets[i]._deviceId] = _tmpSockets[i].id;
  }

  var users = this.channels[_app+'^'+_channel];
  var _users = [];
  var currentTimestamp = Date.now();
  for(var x=0; x<users.length; x++){

    if(!_tmpIds[users[x].userId+"^"+users[x].deviceId]){

      _users.push({
        userId:   users[x].userId,
        deviceId: users[x].deviceId
      });

      var serverNode = self.nodeManager.getServerNode(_app + users[x].userId);

      self.sessionManager.publish(
        serverNode.name,
        {
          _type: 'message', /* IMPORTANT */
          app: _app,
          channel: _channel,
          userId: users[x].userId,
          deviceId: users[x].deviceId,
          notiId: users[x].notiId,
          name: _name,
          data: _data,
          timestamp: currentTimestamp
        }
      );

    }
  }

  if( _users.length > 0) {

    mongoPersister.storeMessages(
      _app,
      _channel,
      _name,
      _data,
      _users,
      currentTimestamp,
      function (err) {
        if(err) {
          console.log(err);
          if(callback) callback(err);
        }else{
          if(callback) callback(null);
        }
      }
    );
  }else{
    if(callback) callback(null);
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


ChannelServer.prototype.getChannelServer = function (_app, _channel, fn) {

  var self = this;

  this.sessionManager.retrieve(_app, _channel, function (server) {

    var serverInfo = '';
    if(server){
      serverInfo = self.nodeManager.getServerNodeByName(server);

      if(!serverInfo) { // remove the server data from redis session storage.
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
    if(!serverInfo){

      serverNode = self.nodeManager.getServerNode(_channel);

      if(!serverNode){
        return fn();
      }
    }

    fn({
      name: serverNode.name,
      url: serverUtils.setHttpProtocal(serverNode.url)
    });

  });
};


ChannelServer.prototype.session_on = function (_event, _fn) {
  this.methods.SESSION_SOCKET[_event] = _fn;
};

ChannelServer.prototype.channel_on = function (_event, _fn) {
  this.methods.CHANNEL_SOCKET[_event] = _fn;
};

var events  = require('events'),
    restify = require('restify'),
    sio     = require('socket.io'),
    util    = require('util'),
    async   = require('async'),
    
    serverUtils       = require('./utils'),
    database          = require('../mongodb-persister/database'), 
    NodeManager       = require('../node-manager/node-manager.js').NodeManager,
    SessionManager    = require('../session-manager/session-manager.js').SessionManager,
    SessionSubscriber = require('../session-manager/session-subscriber.js').SessionSubscriber,
    mongoPersister    = require('../mongodb-persister/mongoPersister');


var ChannelServer = exports.ChannelServer = function (options) {
  
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
        },
        
        // 4.Fork the message process
        function(callback){
          
          var mp_args =[ 
            self.options && self.options.mongodb && self.options.mongodb.address ? self.options.mongodb.address : '',
            'xpush',
            self.options && self.options.redis && self.options.redis.address ? self.options.redis.address : ''
          ];
          
          self.message_process = require('child_process').fork(__dirname+'/message-process.js', mp_args);
          self.message_process.on('message', function(data) {
            
            if(data.err){ 
              callback(data.err);
            }else{
              
              if( data.message && data.message == 'connect' ) {
                console.info('  - Message Process is forked'); 
                callback(null); 
              }else{
                // do somthing  
                console.log(' >> received from message-process: ' + data.message); // Do something ??
                callback(null);
              }
            }
          });
          
        }],
      
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
  
  this.server = restify.createServer();
  this.server.use(restify.bodyParser());
  this.server.use(restify.CORS( {origins: ['*']}));
  this.server.use(restify.fullResponse());
  // Needed this for OPTIONS preflight request: https://github.com/mcavage/node-restify/issues/284
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
    }
    else {
      return res.send(new restify.MethodNotAllowedError());
    }
  }
  this.server.on('MethodNotAllowed', unknownMethodHandler);  

  this.io = sio.listen(this.server);
  
  this.io.of('/session').authorization(function (handshakeData, callback) {
    
    var _app      = handshakeData.query.app;
    var _userId   = handshakeData.query.userId;
    var _deviceId = handshakeData.query.deviceId;
    var _token    = handshakeData.query.token;
    
    
    if( !_app || !_userId || !_token || !_deviceId ) {
      callback('Parameter is not corrected. (app, userId, deviceId, token) ', false);
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
          
          // ####################################### //
          handshakeData._app        = _app;
          handshakeData._userId     = _userId;
          handshakeData._deviceId   = _deviceId;
          // ####################################### //
          
          callback(null, true);
          
        }else{
          
          callback('Auth token is not available.', false);
        }
        return;
      }
      
    });
    
  }).on('connection', function (socket) {
    
    self.socketIds[
      socket.handshake._app+'_'+
      socket.handshake._userId+'_'+
      socket.handshake._deviceId
    ] = socket.id;
    
    socket.on('channel-create', function (params, callback) {
      
      if(!params.users || params.users.length == 0){
        callback({
          status: 'error',
          message: 'Channel have to include users.'
        });
        return;
      }
      
      mongoPersister.createChannel(
        socket.handshake._app, 
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
            if(callback) callback({
              status: 'ok',
              result: data
            });
            
          }
        });
      
    });
    
    socket.on('channel-list', function (callback) {
      
      mongoPersister.listChannel(
        socket.handshake._app, 
        socket.handshake._userId, 
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
    
    socket.on('channel-user-add', function (params, callback) {
      
      var err = serverUtils.validSocketParams(params, ['channel','userId']);
      if(err){
        callback(err);
        return;
      }
      
      mongoPersister.addChannelUser(
        socket.handshake._app, 
        params.channel, 
        socket.handshake._userId, 
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
    
    socket.on('channel-user-exit', function (params, callback) {
      
      var err = serverUtils.validSocketParams(params, ['channel']);
      if(err){
        callback(err);
        return;
      }
      
      mongoPersister.exitChannel(
        socket.handshake._app, 
        params.channel, 
        socket.handshake._userId, 
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
    
    socket.on('user-list', function (params, callback) {
      
      mongoPersister.searchUser(
        socket.handshake._app, 
        params.keys,    // optional
        params.values,  // optional
        function (err, users){
          if(err){ 
            
            console.log(err);
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

    socket.on('message-unread', function (params, callback){

      var err = serverUtils.validSocketParams(params, ['channel']);
      if(err){
        callback(err);
        return;
      }

      mongoPersister.unReadMessage(
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

    
    socket.on('disconnect', function () {
      
      delete self.socketIds[
        socket.handshake._app+'_'+
        socket.handshake._userId+'_'+
        socket.handshake._deviceId
      ];

    });
    
  });
  
  
  this.io.of('/channel').authorization(function (handshakeData, callback) {
    
    // TODO 
    // Check the channel is available (Existed? ) ?
    // or this is wasted ?
    
    var _app      = handshakeData.query.app;
    var _channel  = handshakeData.query.channel;
    var _server   = handshakeData.query.server;
    var _userId   = handshakeData.query.userId;
    var _deviceId = handshakeData.query.deviceId;
    
    if( !_app || !_channel || !_server ) {
      callback('Parameter is not corrected. (app, channel, server) ', false);
      return;
    }
    
    
    // ####################################### //
    handshakeData._app   		= _app;
    handshakeData._channel  = _channel;
    handshakeData._server   = _server;
    handshakeData._userId   = _userId;
    handshakeData._deviceId = _deviceId;
    // ####################################### //
    
    callback(null, true);
    
  }).on('connection', function (socket) {
    
    var _room = socket.handshake._app+'^'+socket.handshake._channel;
    
    socket.join(_room);
    
    socket._userId 		= socket.handshake._userId
    socket._deviceId 	= socket.handshake._deviceId
    
    var _count_of_this_channel = 
        self.io.of('/channel').clients(_room).length;
    
    self.sessionManager.update(
      socket.handshake._app, 
      socket.handshake._channel, 
      socket.handshake._server, 
      _count_of_this_channel);
    
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
      
      self.send(
        socket.handshake._app, 
        socket.handshake._channel, 
        params.name, 
        params.data, 
        callback);
      
    });

    socket.on('message-unread', function (callback){

      mongoPersister.unReadMessage(
        socket.handshake._app, 
        socket.handshake._channel, 
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
    
    socket.on('disconnect', function () {
      
      var _a = socket.handshake._app;      
      var _c = socket.handshake._channel;
      
      var _room = _a+'^'+_c;
      
      socket.leave(_room);
      
      var _count_of_this_channel = 0;
      if(self.io.of('/channel').clients(_room)){
        _count_of_this_channel = self.io.of('/channel').clients(_room).length;
      }
      
      self.sessionManager.update(
        _a, _c, socket.handshake._server, _count_of_this_channel
      );
      
    });
    
  });
  
  // notification !!!!
  self.sessionSubscriber.on('message', function(receivedData) {
    
    var _socketId = self.socketIds[
      receivedData.app+'_'+
      receivedData.userId+'_'+
      receivedData.deviceId
    ];

    var _socket = self.io.of('/session').socket(_socketId);
    
    if(_socket) { // applicacation is alive. Session socket is connected !!
      
      self.storeMessage(
        receivedData.app, 
        receivedData.channel,
        receivedData.userId,
        receivedData.deviceId,
        receivedData.data
      );

      _socket.emit('NOTIFICATION', {
        name: receivedData.name,
        data: receivedData.data
      });
      
    } else { // application was OFF.
      
      if(receivedData.notiId){

        self.storeMessage(
          receivedData.app, 
          receivedData.channel,
          receivedData.userId,
          receivedData.deviceId,
          receivedData.data
        );
        
        // existed mobile notification token ?
        // TODO implements GCM / APN process !!!!!
        console.log('!!!!!!TODO!!!!!! Notification with notiId ['+receivedData.notiId+']');
        
      }else{
        
        // This is not support for Mobile Notification. Do Nothing !!!
      }
    }
    
  });
  
  // restful sending message from client and server
  self.server.post('/send', function (req, res, next) {
    
    var err = serverUtils.validEmptyParams(req, ['app', 'channel','name','data']);
    if(err){
      next(err);
      return;
    }
    
    self.send(
      req.params.app, 
      req.params.channel, 
      req.params.name, 
      req.params.data, 
      function (){
        res.send({status: 'ok'});
      });
    
  });
  
  if(this.options.type && this.options.type == 'PROXY'){
    require('../routes/routes')(self.server, self.nodeManager);
  }
  
  this.server.listen(this.options.port, function () {
    self.emit('connected', self.server.url, self.options.port);
  });
  
};


ChannelServer.prototype.send = function (_app, _channel, _name, _data, callback) {
  
  var self = this;
  var _room = _app + '^' + _channel;
  
  if(this.io.of('/channel').in(_room) != undefined){
    this.io.of('/channel').in(_room).emit(_name, _data);
  }
  
  // TODO
  // Using the mongodb aggregation or somthing efficient !!!!
  // And by forked process !!!
  
  var _tmpSockets = self.io.of('/channel').clients(_room);
  var _tmpIds     = {};
  
  for(var i=0; i<_tmpSockets.length; i++){
    _tmpIds[_tmpSockets[i]._userId+"^"+_tmpSockets[i]._deviceId] = _tmpSockets[i].id;
  }
  
  mongoPersister.getUsersForNotification(_app, _channel, function (err, users, msg) {
    
    if(err) {
      process.send(err);
      return;
    }
    
    if(users == null || typeof users == 'undefined' )  if(callback) callback();
    
    for(var i=0; i<users.length; i++){
      
      var user = users[i];
      
      if(!_tmpIds[user.userId+"^"+user.deviceId]){
        
        var serverNode = self.nodeManager.getServerNode(_app + user.userId);
        
        self.sessionManager.publish(
          serverNode.name, 
          {
            app: _app,
            channel: _channel,
            userId: user.userId,
            deviceId: user.deviceId,
            notiId: user.notiId,
            name: _name, 
            data: _data
          } 
        );
      }
      
    }
    
  });
  
  /*
  this.message_process.send({
    action: 'notification',
    app: _app,
    channel: _channel,
    data: _data 
  });
  */
  
  if(callback) callback();
  
};

ChannelServer.prototype.storeMessage = function (_app, _channel, _userId, _deviceId, _data, callback) {

  mongoPersister.storeMessage(
    _app, 
    _channel, 
    _userId,
    _deviceId,
    _data, 
    function (err) {
      if(err) {
        console.log(err);
        if(callback) callback(err);
      }else{
        if(callback) callback(null);
      }
    }
  );

};


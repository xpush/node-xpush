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


var ApiServer = exports.ApiServer = function (options) {

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


  try {
 
    console.log('\n');
    async.parallel([

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
          false,   // In case of API Server, do not watch the status of server nodes.
          function (err) {
            if(!err){
              console.info('  - Zookeeper is connected');
              self.nodeManager.addServerNode(self.options.host, self.options.port, function (err, path) {
                if(!err)console.info('  - Server Node is created : ' + path);
                
                var serverName = path.substring(path.lastIndexOf('/')+1, path.length);
                serverName = serverName.split('^')[0]
                
                self.serer = serverName;
                
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
          'xpush'
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
            self.options && self.options.redis && self.options.redis.address ? self.options.redis.address : '', self.server,
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

util.inherits(ApiServer, events.EventEmitter);

ApiServer.prototype.startup = function () {

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

  var self = this;

  /**** Handling socket.io requests ****/ 
  this.io.sockets.on('connection', function (socket) {

    
    /*** SESSION SOCKET ***/
    
    // USER-LOGIN
    // params : app, server, usreId, deviceType, notiId
    socket.on('user-login', function (params, callback) {
      
      socket._T = 'S'; // the type of socket is 'S' (Session).
      socket.app        = params.app;
      socket.userId     = params.userId;
      socket.sessionId  = params.server + '^' + socket.id; // ( also using by notiId on 'WEB' )
      
      if(params.deviceType && params.deviceType == 'web') params.notiId = socket.sessionId;

      mongoPersister.updateUser(params.app, params.userId, socket.sessionId, params.notiId, function (err){
        if(err){
          if(callback) callback({
            status: 'error',
            message: err
          });

        }else{
          if(callback) callback({
            status: 'ok',
            result: {userId: socket.userId, sessionId: socket.sessionId, notiId: params.notiId}
          });
        }
      });

    });
    
    // CHANNEL-LIST
    // params : app
    socket.on('channel-list', function (params, callback) {
      
      mongoPersister.listChannel(params.app, socket.userId, function (err, channels){
        if(err){  console.log(err);
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
    
    // CHANNEL-CREATE
    // params : app, channel, users[]
    socket.on('channel-create', function (params, callback) {

      mongoPersister.createChannel(params.app, params.channel, params.users, function (err, data){
        if(err){  console.log(err);
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

    // CHANNEL-JOIN
    // params : app, channel, server, userId, sessionId
    socket.on('channel-join', function (params, callback) {

      socket._T = 'M'; // the type of socket is 'S' (Message).
      socket._sessionId = params.sessionId;
      socket._app = params.app;
      socket._channel = params.channel;
      socket._server = params.server;
      
      socket.join(params.channel);
      
      mongoPersister.joinChannel(params.app, params.channel, params.userId, params.sessionId, function (err, data){
        if(err){  console.log(err);
          if(callback) callback({
            status: 'error',
            message: err
          });

        }else{
          
          var members = self.io.sockets.manager.rooms['/'+params.channel].length;
          self.sessionManager.update(params.app, params.channel, params.server, members);
            
          if(callback){
            callback({
              status: 'ok',
              result: {
                id: socket.id, 
                count: members,
                channel: data
              }
            });
          }
        }
      });

    });
    
    // DATA-SEND
    // params : app, channel, name, data
    socket.on('data-send', function (params, callback) {
      self.send(params.app, params.channel, params.name, params.data, socket._sessionId, callback);
    });

    
    socket.on('disconnect', function () {
    
      if(socket._T == 'M'){
        
        socket.leave(socket._channel);
        
        var members = 0;
        if(self.io.sockets.manager.rooms['/'+socket._channel]){
          members = self.io.sockets.manager.rooms['/'+socket._channel].length;
        }
        
        self.sessionManager.update(
          socket._app, socket._channel, socket._server, members
        );
            
        mongoPersister.offChannel(
          socket._app, socket._channel, socket._sessionId
        );
        
        //console.log('-----------> DISCONNECT - MESSAGE');
        
      }
      
      if(socket._T == 'S'){
        mongoPersister.endAllChannel(socket.app, socket.userId, function (err, result) {
          //console.log('-----------> DISCONNECT - SESSION');
          
        });
      }
    });

  });

  // notification !!!!
  self.sessionSubscriber.on('message', function(socketId, eventNm, message) {
    self.io.sockets.socket(socketId).emit(eventNm, message);
  });

  if(this.options.type && this.options.type == 'PROXY'){
    require('../routes/routes')(self.server, self.nodeManager);
  }
        
  this.server.listen(this.options.port, function () {
    self.emit('connected', self.server.url, self.options.port);
  });

};


ApiServer.prototype.send = function (_app, _channel, _name, _data, _sessionId, callback) {

  if(this.io.sockets.in(_channel) != undefined){
    this.io.sockets.in(_channel).emit(_name, _data);
  }

  if(_sessionId) {

    var tmpClients = this.io.sockets.clients(_channel);
    var tempSessionIds = [];

    for(var i; i<tmpClients.length; i++){
      tempSessionIds.push(tmpClients[i].sessionId);
    }

    this.message_process.send({
      action: 'notification',
      app: _app,
      channel: _channel,
      name: _name,
      data: _data,
      sessionIds : tempSessionIds
    });
  }
  
  if(callback) callback();

};


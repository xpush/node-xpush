var events  = require('events'),
    restify = require('restify'),
    sio     = require('socket.io'),
    util    = require('util'),
    async   = require('async'),

    database       = require('../mongodb-persister/database'), 
    NodeManager    = require('../node-manager/node-manager.js').NodeManager,
    SessionManager = require('../session-manager/session-manager.js').SessionManager,
    mongoPersister = require('../mongodb-persister/mongoPersister');

var ApplicationAPI = require('../modules/app').appAPI;    

var ApiServer = exports.ApiServer = function (options) {
  if (!options || !options.port) {
    throw new Error('Both `options` and `options.port` are required.');
  }

  if (!options.host) options.host = options.host?options.host: this.getIP();

  var _killProcess = function(){
    self.nodeManager.removeServerNode(options.host, options.port,process.exit);
  }
  process.on('SIGINT',_killProcess).on('SIGTERM',_killProcess); // ctrl+c , kill process(except -9)

  events.EventEmitter.call(this);

  this.options = options;

  var self  = this;

  try {
 
    console.log('\n');
    async.parallel([

      // 1. mongodb connection
      function(callback){

        database.config(
          self.options && self.options.mongodb && self.options.mongodb.address ? self.options.mongodb.address : '',
          'xpush',
          function (err, message) {
            console.info('  - Mongodb is connected');
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
            console.info('  - Zookeeper is connected');
            self.nodeManager.addServerNode(self.options.host, self.options.port, function (err, path) {
              console.info('  - Server Node is created : ' + path);
              callback(err);
            });
          }
        );

      },

      // 3.session-manager
      function(callback){
   
        self.sessionManager = new SessionManager(
          self.options && self.options.redis && self.options.redis.address ? self.options.zookeeper.address : '',
          function (err) {
            console.info('  - Redis is connected');
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

          if(data.err) callback(data.err);

          if( data.message && data.message == 'connect' ) {
            console.info('  - Message Process is forked'); 
            callback(null); 
          }else{
            // do somthing  
            console.log(' >> received from message-process: ' + message); // Do something ??
          }
        });

      }],

      // And then, STARTUP !!
      function(err, results){

//        if(self.options.
        
        self.server.listen(self.options.port, function () {

          self.emit('connected', self.server.url, self.options.port);
        });

      }
    );

  } catch(err) {
    console.log(err);
  }



  this.server = restify.createServer();
  this.server.use(restify.bodyParser());
  //this.server.use(restify.CORS( {origins: ['*']}));
  //this.server.use(restify.fullResponse());
  this.io = sio.listen(this.server);

  require('../routes/routes')(this.server);


  /**** Handling socket.io requests ****/ 
  this.io.sockets.on('connection', function (socket) {

    socket.on('join', function (appId, channel, server, sessionId, fn) {

      // TODO channel이 실제로 존재 하는지? 이미 join 하고 있지 않은지 검사 추가 필요 !!

      socket.sessionId = sessionId;

      if(!socket.__data) socket.__data = [];
      socket.__data.push({_app:appId, _channel:channel, _server:server});


      socket.join(channel);
      
      var members = self.io.sockets.manager.rooms['/'+channel].length;

      self.sessionManager.update(appId, channel, server, members);

      if(fn) fn({id: socket.id, count: members});

    });


    socket.on('send', function (app, channel, name, data, sessionId) {
      console.log(channel+"=="+name);
      console.log(data);

      self.send(app, channel, name, data, sessionId);

    });

    socket.on('disconnect', function () {
    
      if(socket.__data){
        for (var i=0; i< socket.__data.length; i++) {

          socket.leave(socket.__data[i]._channel);

          var members = 0;
          if(self.io.sockets.manager.rooms['/'+socket.__data[i]._channel]){
            members = self.io.sockets.manager.rooms['/'+socket.__data[i]._channel].length;
          }

          self.sessionManager.update(
            socket.__data[i]._app, socket.__data[i]._channel, socket.__data[i]._server, members
          );
        }
      }

    });

  });

  initAppAPI(this.server,this.nodeManager);

};

util.inherits(ApiServer, events.EventEmitter);

ApiServer.prototype.send = function (_app, _channel, _name, _data, _sessionId) {

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

};


ApiServer.prototype.getIP = function () {

  var interfaces = require('os').networkInterfaces();
  for (var devName in interfaces) {
    var iface = interfaces[devName];

    for (var i = 0; i < iface.length; i++) {
      var alias = iface[i];
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal)
        return alias.address;
    }
  } 

  return '0.0.0.0';
};

function initAppAPI(was,nodeManager){
  var appAPI = new ApplicationAPI(nodeManager);
  was.post('/app/:appNm', function(req,res){
    appAPI.addApp(req,res);
  });
  was.get('/app/:appId',function(req,res){
    appAPI.getApp(req,res);
  });
  was.del('/app/:appId',function(req,res){
    appAPI.delApp(req,res);
  });
  was.get('/apps',function(req,res){
    appAPI.getApps(res,res);
  });
}

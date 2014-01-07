var events  = require('events'),
    restify = require('restify'),
    sio     = require('socket.io'),
    util    = require('util'),

    database       = require('../mongodb-persister/database'), 
    NodeManager    = require('../node-manager/node-manager.js').NodeManager,
    SessionManager = require('../session-manager/session-manager.js').SessionManager,
    mongoPersister = require('../mongodb-persister/mongoPersister');

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

  var self  = this;

  database.config(
    options && options.mongodb && options.mongodb.address ? options.mongodb.address : '',
    'xpush'
  );

  this.server = restify.createServer();
  this.io = sio.listen(this.server);

  this.nodeManager = new NodeManager(
    options && options.zookeeper && options.zookeeper.address ? options.zookeeper.address : '',
    false,   // In case of API Server, do not watch the status of server nodes.
    function () {
      self.nodeManager.addServerNode(options.host, options.port);
    }
  );

  this.sessionManager = new SessionManager(
    options && options.redis && options.redis.address ? options.zookeeper.address : ''
  );

  /**** REST API ****/ 
  this.server.get('/user/:app/:userId', function (req, res, next) {
    
    mongoPersister.retrieveUser(req.params.app, req.params.userId, function (err, user, msg) {

      if(err) next(err);
      
      if(user){ 
        res.send(user);
      }else{
        res.send(msg);
      }

    });
  });

///////////////////// TODO implements APIs (is these modules ?? )//////////////////////

  /**** Handling socket.io requests ****/ 
  this.io.sockets.on('connection', function (socket) {

    socket.on('join', function (appId, channel, server, fn) {


      if(!socket.__data) socket.__data = [];
      socket.__data.push({_app:appId, _channel:channel, _server:server});


      socket.join(channel);
      
      var members = self.io.sockets.manager.rooms['/'+channel].length;

      self.sessionManager.update(appId, channel, server, members);

      if(fn) fn({id: socket.id, count: members});

    });


    socket.on('send', function (channel, name, data) {
      console.log(channel+"=="+name);
      console.log(data);
      self.io.sockets.in(channel).emit(name, data)   
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

  this.server.listen(options.port, function () {
    self.emit('connected', self.server.url, options.port);
  });

};

util.inherits(ApiServer, events.EventEmitter);

ApiServer.prototype.send = function (channel, data) {
  
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


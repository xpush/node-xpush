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
  this.server.use(restify.bodyParser());
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

  this.server.post('/user/register', function (req, res, next){
    var _param = req.params;

    if (_param.app === undefined) {
      return next(new restify.InvalidArgumentError('App must be supplied'))
    }
    if (_param.userId === undefined) {
      return next(new restify.InvalidArgumentError('User Id must be supplied'))
    }
    if(_param.deviceType === undefined) {
      return next(new restify.InvalidArgumentError('Device Type must be supplied'))
    }
//    if (_param.deviceId === undefined) {
//      return next(new restify.InvalidArgumentError('Device Id must be supplied'))
//    }
    
    mongoPersister.registerUser(_param.app, _param.userId, _param.deviceType, _param.deviceId, _param.notiId, _param.datas, function (err, msg) {

      if(err) next(err);
      res.send(msg);
    });
  });

  this.server.post('/user/login', function (req, res, next){
    var _param = req.params;

    if (_param.app === undefined) {
      return next(new restify.InvalidArgumentError('App must be supplied'))
    }
    if (_param.userId === undefined) {
      return next(new restify.InvalidArgumentError('User Id must be supplied'))
    }
    
    mongoPersister.createUserSessionId(_param.app, _param.userId, function (err, sessionId) {
      if(err) next(err);
      res.send({'sessionId': sessionId});
    });
  });
  
  this.server.post('/user/logout', function (req, res, next){
    var _param = req.params;

    if (_param.app === undefined) {
      return next(new restify.InvalidArgumentError('App must be supplied'))
    }
    if (_param.userId === undefined) {
      return next(new restify.InvalidArgumentError('User Id must be supplied'))
    }
    
    mongoPersister.removeUserSessionId(_param.app, _param.userId, function (err) {
      if(err) next(err);
      res.send({message:'success'});
    });
  });
  

  this.server.post('/channel/create/:channel', function (req, res, next){
    var _param = req.params;

    if (_param.app === undefined) {
      return next(new restify.InvalidArgumentError('App must be supplied'))
    }

    mongoPersister.createChannel(_param.app, _param.channel, _param.sessionId, function (err, channel) {
      if(err) next(err);
      res.send(channel);
    });
  });

  this.server.post('/channel/join/:channel',function (req, res, next){

    var _param = req.params;

    if (_param.app === undefined) {
      return next(new restify.InvalidArgumentError('App must be supplied'))
    }
    if (_param.channel === undefined) {
      return next(new restify.InvalidArgumentError('Channel must be supplied'))
    }

    mongoPersister.joinChannel(_param.app, _param.channel, _param.sessionId, function (err,msg) {
      if(err) next(err);
      res.send(msg);
    });


  });

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


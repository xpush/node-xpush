var events  = require('events'),
    restify = require('restify'),
    util    = require('util'),
    _       = require('underscore'),
    async   = require('async'),

    serverUtils    = require('./utils'),
    NodeConstants  = require('../node-manager/constants'),
    NodeManager    = require('../node-manager/node-manager.js').NodeManager,
    SessionManager = require('../session-manager/session-manager.js').SessionManager,
    database       = require('../mongodb-persister/database'),
    mongoPersister = require('../mongodb-persister/mongoPersister');

var GatewayServer = exports.GatewayServer = function (options) {

  if (!options || !options.port) {
    throw new Error('Both `options` and `options.port` are required.');
  }

  var self  = this;

  if (!options.host) options.host = options.host?options.host: serverUtils.getIP();

  var _killProcess = function(){

    if( self.nodeManager ){
      self.nodeManager.removePath( 
        NodeConstants.META_PATH + NodeConstants.GW_SERVER_PATH + '/' + 
        self.conf.host + ':' + self.conf.port, process.exit
      );
    }
  };
  process.on('SIGINT',_killProcess).on('SIGTERM',_killProcess); // ctrl+c , kill process(except -9)

  events.EventEmitter.call(this);

  
  this.conf = {
    version: module.exports.version,
    host: options.host,
    port: options.port,
    zookeeper: options.zookeeper,
    mongodb: options.mongodb,
    redis: options.redis 
  };
  if(options.restify) this.conf = _.extend(this.conf, options.restify);

  try {

    console.log('\n');
    async.parallel([

  // 1. mongodb connection
      function(callback){
        
        database.config(
          self.conf && self.conf.mongodb && self.conf.mongodb.address ? self.conf.mongodb.address : '',
          'xpush',
          function (err, message) {
            if(!err) console.info('  - Mongodb is connected');
            callback(err);
          }
        );
      },


      // 1. node-manager
      function(callback){
   
        self.nodeManager = new NodeManager(
          self.conf && self.conf.zookeeper && self.conf.zookeeper.address ? self.conf.zookeeper.address : '',
          true,
          function (err) {
            console.info('  - Zookeeper is connected');
             self.nodeManager.createPath(  NodeConstants.META_PATH + NodeConstants.GW_SERVER_PATH + '/' + self.conf.host + ':' + self.conf.port, function (err) {
               console.info('  - Gateway Server Node is created');
               callback(err);
             });
          }
        );
      },

      // 2.session-manager
      function(callback){

        self.sessionManager = new SessionManager(
          self.conf && self.conf.redis && self.conf.redis.address ? self.conf.zookeeper.address : '',
          function (err) {
            console.info('  - Redis is connected');
            callback(err);
          }
        );
      }],

      // And then, STARTUP !!
      function(err, results){
        self.startup();
      }
    );

  } catch(err) {
    console.log(err);
  }

};

util.inherits(GatewayServer, events.EventEmitter);

GatewayServer.prototype.startup = function () {

  var self = this;

  this.server = restify.createServer(this.conf);
  this.server.use(restify.bodyParser());
  this.server.use(restify.CORS( {origins: ['*']}));
  this.server.use(restify.fullResponse());
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

  
  this.server.get('/node/:app/:channel', function (req, res, next) {

    self.sessionManager.retrieve(req.params.app, req.params.channel, function (server) {
      
      var serverInfo = '';
      
      if(server){
        serverInfo = self.nodeManager.getServerNodeByName(server);
        
        if(!serverInfo) { // remove the server data from redis session storage.
          self.sessionManager.remove(req.params.app, req.params.channel);
        }
      }
      
      
      // TODO In the case Not Existed serverNode Object !!
      
      if(!serverInfo){
        serverNode = self.nodeManager.getServerNode(req.params.channel);
      }
      
      res.send({
        status: 'ok', 
        result: {
          channel: req.params.channel, 
          server: serverNode.name, 
          serverUrl: serverUtils.setHttpProtocal(serverNode.url)}
      });
      
      next();
      
    });
    
  });
  
  this.server.post('/auth', function (req, res, next) {

    var err = serverUtils.validEmptyParams(req, ['app', 'userId', 'password', 'deviceId']);
    if(err){
      res.send({status: 'error', message: err});
      return;
    }
  
    mongoPersister.retrieveUser( 
      req.params.app, 
      req.params.userId, 
      req.params.deviceId, 
      function (err, user) {
        
      if(err) {
        next(err);
        return;
      }
      
      if(!user) {
				res.send({status: 'error', message: 'User is not existed.'});
        return;
      }
      
      var _pw = serverUtils.encrypto(req.params.password);

      if(user.password == _pw){
        
        mongoPersister.updateUserToken(
          user.app, 
          user.userId, 
          serverUtils.randomString(10), 
          function (err, token) {
          
          if(err){
            res.send({status: 'error', message: err});
            return;
          }

          var serverNode = self.nodeManager.getServerNode(req.params.app + req.params.userId);
          var _url 	 = serverUtils.setHttpProtocal(serverNode.url);
            
          res.send({
            status: 'ok', 
            result: {
              'token': token,
              'server': serverNode.name, 
              'serverUrl': _url}
          });
          
          // TODO
          // store userId and token to check this token when connection of session socket.
            
        });
        
      }else{
        
        res.send({status: 'error', message: 'Password is not corrected'});
      }
    });
    
  });
    


  if(!this.conf.type || this.conf.type != 'PROXY'){
    require('../routes/routes')(this.server, this.nodeManager);
  }

  this.server.listen(this.conf.port, function () {
    self.emit('connected', self.server.url, self.conf.port);
  });
};




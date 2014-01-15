var events  = require('events'),
    restify = require('restify'),
    util    = require('util'),
    _       = require('underscore'),
    async   = require('async'),

    serverUtils    = require('./utils'),
    NodeConstants  = require('../node-manager/constants'),
    NodeManager    = require('../node-manager/node-manager.js').NodeManager,
    SessionManager = require('../session-manager/session-manager.js').SessionManager;

var GatewayServer = exports.GatewayServer = function (options) {

  if (!options || !options.port) {
    throw new Error('Both `options` and `options.port` are required.');
  }

  var self  = this;

  if (!options.host) options.host = options.host?options.host: serverUtils.getIP();

  var _killProcess = function(){

    if( self.nodeManager ){
      self.nodeManager.removePath( NodeConstants.META_PATH + NodeConstants.GW_SERVER_PATH + '/' + self.conf.host + ':' + self.conf.port, process.exit);
    }
  }
  process.on('SIGINT',_killProcess).on('SIGTERM',_killProcess); // ctrl+c , kill process(except -9)

  events.EventEmitter.call(this);

  this.conf = {
    version: module.exports.version,
    host: options.host,
    port: options.port
  };
  if(options.restify) conf = _.extend(conf, options.restify);

  try {

    console.log('\n');
    async.parallel([

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
  this.server.use(restify.queryParser());
  this.server.use(restify.jsonp());

  this.server.get('/node/:app/:channel', function (req, res, next) {

    console.log(req.headers['host']);
    console.log(req.url);

    self.sessionManager.retrieve(req.params.app, req.params.channel, function (server) {


      var serverInfo = '';

      if(server){
        serverInfo = self.nodeManager.getServerNodeByName(server);

        if(!serverInfo) { // remove the server data from redis session storage.
          self.sessionManager.remove(req.params.app, req.params.channel);
        }
      }
      
      if(!serverInfo){
        serverNode = self.nodeManager.getServerNode(req.params.channel);
      }

      res.send({channel: req.params.channel, name: serverNode.name, server: serverNode.url});
      
      next();

    });

  });


  if(!this.conf.type || this.conf.type != 'PROXY'){
    require('../routes/routes')(this.server, this.nodeManager);
  }

  this.server.listen(this.conf.port, function () {
    self.emit('connected', self.server.url, self.conf.port);
  });
};




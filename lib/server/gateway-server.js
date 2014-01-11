var events  = require('events'),
    restify = require('restify'),
    util    = require('util'),
    _       = require('underscore'),
    async   = require('async'),
    NodeManager    = require('../node-manager/node-manager.js').NodeManager,
    SessionManager = require('../session-manager/session-manager.js').SessionManager;

var GatewayServer = exports.GatewayServer = function (options) {

  if (!options || !options.port) {
    throw new Error('Both `options` and `options.port` are required.');
  }

  events.EventEmitter.call(this);
  
  var self  = this;

  this.conf = {
    version: module.exports.version,
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
            callback(err);
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

  this.server.get('/channel/:app/:channel', function (req, res, next) {

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

  this.server.listen(self.conf.port, function () {
    self.emit('connected', self.server.url, self.conf.port);
  });
};


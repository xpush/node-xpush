var events  = require('events'),
    restify = require('restify'),
    util    = require('util'),
    _       = require('underscore');
    NodeManager    = require('../node-manager/node-manager.js').NodeManager,
    SessionManager = require('../session-manager/session-manager.js').SessionManager;

var GatewayServer = exports.GatewayServer = function (options) {

  if (!options || !options.port) {
    throw new Error('Both `options` and `options.port` are required.');
  }

  events.EventEmitter.call(this);
  
  var self  = this;

  var conf = {
    version: module.exports.version
  };
  if(options.restify) conf = _.extend(conf, options.restify);

  this.nodeManager = new NodeManager(
    conf && conf.zookeeper && conf.zookeeper.address ? conf.zookeeper.address : '',
    true
  );

  this.sessionManager = new SessionManager(
    conf && conf.redis && conf.redis.address ? conf.zookeeper.address : ''
  );

  this.server = restify.createServer(conf);
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
          self.sessionManager.remove(app, channel);
        }
      }
      
      if(!serverInfo){
        serverNode = self.nodeManager.getServerNode(req.params.channel);
      }

      res.send({channel: req.params.channel, name: serverNode.name, server: serverNode.url});
      
      next();


    });

  });
 

  this.server.listen(options.port, function () {
    self.emit('connected', self.server.url, options.port);
  });

};

util.inherits(GatewayServer, events.EventEmitter);

GatewayServer.prototype.test = function () {
  console.log('dddddddd');
};


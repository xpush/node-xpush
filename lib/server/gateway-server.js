var events  = require('events'),
    restify = require('restify'),
    util    = require('util'),
    _       = require('underscore');
//    nodeManager = require('../node-manager/node-manager.js');

var GatewayServer = exports.GatewayServer = function (options) {
  if (!options || !options.port) {
    throw new Error('Both `options` and `options.target` are required.');
  }

  events.EventEmitter.call(this);
  
  var self  = this;

  var conf = {
    version: module.exports.version
  };
  if(options.restify) conf = _.extend(conf, options.restify);

  this.server = restify.creteServer(conf);
  this.server.use(restify.queryParser());
  this.server.use(restify.jsonp());

  this.server.get('/channel/:name', function (req, res, next) {
    res.send({hello: 'world', test: name});
    next();
  });

  this.server.listen(options.port, function () {
    self.emit('connected', self.server.url, options.port);
  });
};

util.inherits(GatewayServer, events.EventEmitter);

GatewayServer.prototype.test = function () {
  console.log('dddddddd');
};

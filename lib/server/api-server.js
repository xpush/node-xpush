var events  = require('events'),
    restify = require('restify'),
    sio     = require('socket.io'),
    util    = require('util'),
    channel = require('./channel.js');

var ApiServer = exports.ApiServer = function (options) {
  if (!options || !options.port) {
    throw new Error('Both `options` and `options.port` are required.');
  }

  events.EventEmitter.call(this);
  this.server = restify.createServer();
  this.io = sio.listen(this.server);

  var self  = this;

  this.io.sockets.on('connection', function (socket) {

    socket.on('message', function (from, msg) {
      console.log('I received a private message by ', from, ' saying ', msg);
    });

    socket.on('disconnect', function () {
      selk.io.sockets.emit('user disconnected');
    });

  });

  this.server.listen(options.port, function () {
    self.emit('connected', self.server.url, options.port);
  });

};

util.inherits(ApiServer, events.EventEmitter);

ApiServer.prototype.test = function () {
  console.log('dddddddd');
};

var events  = require('events'),
    sio     = require('socket.io'),
    util    = require('util'),
    channel = require('./channel.js');

var ApiServer = exports.ApiServer = function (options) {
  if (!options || !options.port) {
    throw new Error('Both `options` and `options.target` are required.');
  }

  events.EventEmitter.call(this);

  this.io = sio.listen(options.port);

  var self  = this;
  this.io.sockets.on('connection', function (socket) {

    socket.on('message', function (from, msg) {
      console.log('I received a private message by ', from, ' saying ', msg);
    });

    socket.on('disconnect', function () {
      selk.io.sockets.emit('user disconnected');
    });

  });

};

ApiServer.prototype.test = function () {
  console.log('dddddddd');
};

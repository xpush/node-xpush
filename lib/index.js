var EventEmitter = require('events').EventEmitter,
    sio          = require('socket.io');
    util         = require('util');


function NPush() {
  if (!(this instanceof NPush)) {
    return new NPush();
  }
  
  EventEmitter.call(this);
  
  this.stats = {};
}

util.inherits(NPush, EventEmitter);

NPush.prototype._privateVar = { test11 : "TEST" };

NPush.prototype._privateFun = function (n) { return n + 1; }  


NPush.prototype.init = function (_conf, cb) {
  var self = this;
  this.conf = _conf;
  this.emit('init', this.conf);

  return self;
}



NPush.prototype.spawnInstance = function () {
  var m = NPush();
  this.emit('spawn', m);
  return m;
}

module.exports = NPush();

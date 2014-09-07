var events = require('events'),
  util = require('util'),
  redis = require('redis');

var SessionSubscriber = exports.SessionSubscriber = function(addr, server, callback) {

  if (addr) {
    this.redisClient = redis.createClient(addr.split(':')[1], addr.split(':')[0]);
  }
  else {
    this.redisClient = redis.createClient();
  }

  events.EventEmitter.call(this);

  var self = this;

  this.redisClient.on("error", function(err) {
    console.log("Redis Subscriber error encountered", err);
  });

  this.redisClient.on("end", function() {
    console.log("Redis Subscriber connection closed");
  });

  this.redisClient.once("connect", function() {

    // 해당 서버로 pulbish 되는 메세지를 subscribe 한다.
    self.redisClient.subscribe('C-' + server);
    console.log('Redis Subscriber - channel : C-' + server);

    if (callback) callback(null);

  });

  this.redisClient.on('message', function(c, data) {

    console.log('### REDIS Subscribe event : ' + c);

    var dataObj = JSON.parse(data);

    console.log('####       app(A)  : ' + dataObj.A);
    console.log('####   channel(C)  : ' + dataObj.C);
    console.log('####  socketId(SS) : ' + dataObj.SS);
    console.log('####      name(NM) : ' + dataObj.NM);

    // publish 받은 data를 현재 server에 emit한다.
    self.emit('message', dataObj);

  });

};

util.inherits(SessionSubscriber, events.EventEmitter);

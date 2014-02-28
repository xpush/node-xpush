var events  = require('events'),
    util    = require('util'),
    redis   = require('redis');

var SessionSubscriber = exports.SessionSubscriber = function (addr, server, callback) {

  if(addr){
    this.redisClient = redis.createClient(addr.split(':')[1], addr.split(':')[0]);
  }else{
    this.redisClient = redis.createClient();
  }

  events.EventEmitter.call(this);
  
  var self = this;

  this.redisClient.on("error", function (err) {
    console.log("Redis Subscriber error encountered", err);
  });

  this.redisClient.on("end", function() {
    console.log("Redis Subscriber connection closed");
  });

  this.redisClient.once("connect", function() {
    
    self.redisClient.subscribe('C-'+server);
    
    if(callback) callback(null);
    
  });

  this.redisClient.on('message', function (c, data) {
		
		var dataObj = JSON.parse(data);
    self.emit('message', dataObj);
		
  });

};

util.inherits(SessionSubscriber, events.EventEmitter);

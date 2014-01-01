var events       = require('events'),
    util         = require('util'),
    redis	       = require('redis');


var SessionManager = exports.SessionManager = function (config) {

  var port = config.port || 6379;
  var host = config.host || '127.0.0.1';
 
  events.EventEmitter.call(this);

  this.redisClient = redis.createClient(port, host);

};

util.inherits(SessionManager, events.EventEmitter);

SessionManager.prototype.create = function(app, channel){

  var self = this;

  this.redisClient.hget(app, channel, function (err, result) [
    if(result){
      
    }else{
    }  
  });

};


/** arguments: app, channel, server, count **/
SessionManager.prototype.update = function(app, channel, server, count){

  if(count > 0){
    var s = {s:server, c:count};
    this.redisClient.hset(app, channel, JSON.stringify(s)); 
  }else{
    this.redisClient.hdel(app, channel);
  } 

};


var Utils = {
  sorting: function(f, r, p){
    var key = function (x) {return p ? p(x[f]) : x[f]};
    return function (a,b) {
      var A = key(a), B = key(b);
      return ((A < B) ? -1 : (A > B) ? +1 : 0) * [-1,1][+!!r];
    }
  },
}

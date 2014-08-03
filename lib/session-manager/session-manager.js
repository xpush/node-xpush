var events    = require('events'),
    util      = require('util'),
    redis     = require('redis'),
    redisscan = require('./redis-scan');

var SessionManager = exports.SessionManager = function(addr, callback) {

  if (addr) {
    this.redisClient = redis.createClient(addr.split(':')[1], addr.split(':')[0]);
  }
  else {
    this.redisClient = redis.createClient();
  }

  events.EventEmitter.call(this);

  this.redisClient.on("error", function(err) {
    console.log("Redis error encountered", err);
  });

  this.redisClient.on("end", function() {
    console.log("Redis connection closed");
  });

  this.redisClient.once("connect", function() {
    if (callback) callback(null);
  });

  //if(callback) callback(null);

};

util.inherits(SessionManager, events.EventEmitter);


/**
 * Get the server number according to channel name from redis hash table.

 * app : application key
 * channel : channel name
 **/
SessionManager.prototype.retrieve = function(app, channel, callback) {

  this.redisClient.hget(app, channel, function(err, result) {

    if (result) {
      callback(JSON.parse(result).s);
    }
    else {
      callback();
    }
  });

};

SessionManager.prototype.retrieveChannelList = function(key, pattern, callback) {
  var reVa = [];
  redisScan({
    redis: redis,
    cmd : 'HSCAN',
    key : key,
    pattern : pattern,
      each_callback: function (type, key, subkey, value,cursor, cb) {
        //console.log(key,subkey,value);
        //console.log(arguments);
        reVa.push({key: subkey, value: value });
        cb();
      },
      done_callback: function (err) {
          console.log("-=-=-=-=-=--=-=-=-");
          callback(err,reVa);
          //redis.quit();
      }
  });
/*
  this.redisClient.hgetall(app, function(err, result) {
    if (result) {
      callback(result);
    }
    else {
      callback();
    }
  });
*/
};

/**
 * Remove server datas from redis hash table..

 * app : application key
 * channel : channel name
 **/
SessionManager.prototype.remove = function(app, channel) {
  this.redisClient.hdel(app, channel);
};

/**
 * Update connection informations into redis server.
 * If the number of connections in this channel is ZERO, delete data from redis hash table.
 *
 * app : application key
 * channel : channel name
 * server : server number (auth-generated into zookeeper)
 * count : the number of connections
 *
 **/
SessionManager.prototype.update = function(app, channel, server, count) {

  if (count > 0) {
    var s = {
      s: server,
      c: count
    };
    this.redisClient.hset(app, channel, JSON.stringify(s));
  }
  else {
    this.redisClient.hdel(app, channel);
  }

};

SessionManager.prototype.publish = function(server, dataObj) {

  console.log('#### REDIS Publish : ' + 'C-' + server);
  console.log('####       app(A)  : ' + dataObj.A);
  console.log('####   channel(C) : ' + dataObj.C);
  console.log('####  socketId(SS) : ' + dataObj.SS);
  console.log('####      name(NM) : ' + dataObj.NM);

  this.redisClient.publish('C-' + server, JSON.stringify(dataObj));

};


/*
var Utils = {
  sorting: function(f, r, p) {
    var key = function(x) {
      return p ? p(x[f]) : x[f];
    };
    return function(a, b) {
      var A = key(a),
        B = key(b);
      return ((A < B) ? -1 : (A > B) ? +1 : 0) * [-1, 1][+ !! r];
    };
  }
};
*/

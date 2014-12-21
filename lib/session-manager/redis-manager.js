var events    = require('events'),
  util      = require('util'),
  redis     = require('redis'),
  RedisShard = require('redis-shard');

  module.exports = function RedisManager(config) {

  var self = {};
  var masterAddr;

  if( config.redis ){
    masterAddr =  config.redis.addr

    if( config.redis.address.master ){
      masterAddr = config.redis.address.master;
    } else {
      masterAddr = config.redis.address;  
    }

  } else {
    masterAddr = "127.0.0.1:6379";
  }

  var client = redis.createClient(masterAddr.split(':')[1], masterAddr.split(':')[0]);
  var shardedClient;

  if( config.redis.address.slave ){
    var options = { servers: config.redis.address.slave };
    shardedClient = new RedisShard(options);
  }

  var WRITES = [
    "publish", "subscribe", "on", "once", "hset", "hdel", "set"
  ];

  WRITES.forEach(function(command) {
    self[command] = function() {
      client[command].apply(client, arguments);
    };
  });

  var READS = [
    "hget", "hgetall", "get"
  ];

  READS.forEach(function(command) {
    self[command] = function() {
      if( shardedClient ){
        shardedClient[command].apply(client, arguments);
      } else {
        client[command].apply(client, arguments);
      }
    };
  });

  return self; 
};
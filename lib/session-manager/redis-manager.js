var util      = require('util'),
  redis       = require('redis'),
  async       = require('async'),
  RedisShard  = require('redis-shard');

  module.exports = function RedisManager(config) {

  var self = {};
  var clients = [];
  var masterAddr;
  var hasSlaveNode = config && config.address && config.address.slave

  if( config && config.address ){
    if(  config.address.master ){
      masterAddr = config.address.master;
    } else {
      masterAddr = config.address;  
    }
  } else {
    masterAddr = "127.0.0.1:6379";
  }

  var client = redis.createClient(masterAddr.split(':')[1], masterAddr.split(':')[0]);
  clients.push( client );

  var shardedClient;

  if( hasSlaveNode ){
    var options = { servers: config.address.slave };
    shardedClient = new RedisShard(options);
    clients.push( shardedClient );
  }

  var WRITES = [
    "publish", "subscribe", "hset", "hdel", "set", "expire"
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

  self.on = function(event, listener) {
    clients.forEach(function(c) {
      c.on(event, function() {
        // append server as last arg passed to listener
        var args = Array.prototype.slice.call(arguments);
        listener.apply(undefined, args);
      });
    });
  };

  // Note: listener will fire once per shard, not once per cluster
  self.once = function(event, listener) {

    async.parallel(
      [
        function(callback) {
          client.once(event, function() {
            callback(undefined, 'one');
          });
        },
        function(callback) {
          if( hasSlaveNode ){
            var connected = 0;
            shardedClient.once(event, function() {
              connected++;
              if( connected == config.address.slave.length ){
                callback(undefined, 'two');
              }
            });
          } else {
            callback(undefined, 'two');
          }
        }
      ],
      function(err, results) {
        var args = Array.prototype.slice.call(arguments).concat( "result" );
        listener.apply(undefined, args);
      }
    );
  };

  return self; 
};
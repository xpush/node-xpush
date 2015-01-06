var events    = require('events'),
    util      = require('util'),
    redis     = require('redis'),
    redisScan = require('./redis-scan'),
    RedisManager = require( './redis-manager');

var SessionManager = exports.SessionManager = function(config, callback) {

  var self = this;

  this.conf = {};

  if (typeof(config) == 'function' && !callback) {
    callback = config;

    // default configurations
    this.conf.expire = 120; // redis expire TTL (seconds)

  } else {
    this.conf = config;
  }

  this.redisClient = new RedisManager( this.conf  );

  events.EventEmitter.call(this);

  this.redisClient.on("error", function(err) {
    console.log("Redis error encountered : " + err);
  });

  this.redisClient.on("end", function(err) {
    console.log("Redis connection closed");
    if (callback) callback('ERR-REDIS', 'failed to connect to Redis server(s). ');
  });

  this.redisClient.once("connect", function() {
    console.log( 'connected' );
    if (callback) callback(null);
  });
};

util.inherits(SessionManager, events.EventEmitter);


/**
 * Get the server number according to channel name from redis hash table.

 * @name retrieve
 * @function
 * @param {string} app - application key
 * @param {string} channel - channel name
 * @param {callback} callback - callback function
 */
SessionManager.prototype.retrieve = function(app, channel, callback) {
  this.redisClient.hgetall(app+":"+channel, function (err, res) {
    callback(res);
  });
};

/**
 * Get the server number according to channel name from redis hash table.

 * @name retrieve
 * @function
 * @param {string} app - application key
 * @param {string} channel - channel name
 * @param {callback} callback - callback function
 */
SessionManager.prototype.retrieveOne = function(app, channel,key, callback) {
  this.redisClient.hget(app+":"+channel,key, function (err, res) {
    callback(err,res);
  });

};

/**
 * Remove server datas from redis hash table

 * @name remove
 * @function
 * @param {string} app - application key
 * @param {string} channel - channel name
 */
SessionManager.prototype.remove = function(app, channel) {
  this.redisClient.hdel(app, channel);
};

/**
 * Update connection informations into redis server.
 * If the number of connections in this channel is ZERO, delete data from redis hash table.
 *
 * @name update
 * @function
 * @param {string} app - application key
 * @param {string} channel - channel name
 * @param {string} server - server number (auth-generated into zookeeper)
 * @param {number} count - the number of connections
 *
 */
SessionManager.prototype.update = function(app, channel, server, count, callback) {

  var hkey = app+":"+channel;

  if(callback){
    if (count > 0) {
      this.redisClient.hset(hkey, server, count, callback);
      this.redisClient.expire(hkey, this.conf.expire, function( err, res ){
      });
    } else {
      this.redisClient.hdel(hkey, server, callback);
    }

  }else{
    if (count > 0) {
      this.redisClient.hset(hkey, server, count);
      this.redisClient.expire(hkey, this.conf.expire, function( err, res ){
      });
    } else {
      this.redisClient.hdel(hkey, server);
    }
  }

};

/**
 * Publish data to another server.
 * @name publish
 * @function
 * @param {string} server - server number
 * @param {object} dataObj -  Data to send
 */
SessionManager.prototype.publish = function(server, dataObj) {

  console.log('#### REDIS Publish : ' + 'C-' + server, dataObj);

  this.redisClient.publish('C-' + server, JSON.stringify(dataObj));

};

SessionManager.prototype.retrieveClient = function(app, channel, key, callback) {
  this.redisClient.hget(app+":DATA:"+channel, key, function (err, res) {
    callback(res);
  });
};

SessionManager.prototype.updateClient = function(app, channel, key, value) {

  if(key){
    if(!value) value = "";
    this.redisClient.hset(app+":DATA:"+channel, key, value);
  }
};

SessionManager.prototype.synchronizeClient = function(app, channel, clients, done) {
  this.redisClient.hmset(app+":DATA:"+channel, clients, function (err, res){
    done();
  });
};

SessionManager.prototype.deleteClient = function(app, channel, key) {
  if(key){
    this.redisClient.hdel(app+":DATA:"+channel, key);
  }
};

SessionManager.prototype.retrieveClients = function(app, channel, callback) {
  
  this.redisClient.hgetall(app+":DATA:"+channel, function (err, res) {
    callback(err, res);
  });
};

SessionManager.prototype.retrieveClientsCount = function(app, channel, callback) {
  this.redisClient.hlen(app+":DATA:"+channel, function (err, res) {
    callback(err, res);
  });
};

SessionManager.prototype.retrieveClientsCount = function(app, channel, callback) {
  this.redisClient.hlen(app+":DATA:"+channel, function (err, res) {
    callback(err, res);
  });
};

/**
* Retrieve channel list with hscan @ TODO 확인해봐야 함.
*
* @name retrieveChannelList
* @function
* @param {string} key - application key
* @param {string} pattern - channel name
* @param {callback} callback - callback function
*/
SessionManager.prototype.retrieveChannelList = function(key, pattern, callback) {
  var reVa = [];
  redisScan({
    redis: this.redisClient,
    cmd : 'HSCAN',
    key : key,
    pattern : pattern,
    each_callback: function (type, key, subkey, cursor, value, cb) {
      //console.log(key,subkey,value);
      if(subkey){
        reVa.push({key: subkey, value: value });
      }
      cb();
    },
    done_callback: function (err) {
      callback(err,reVa);
    }
  });
};

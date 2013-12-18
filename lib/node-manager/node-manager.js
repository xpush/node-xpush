var EventEmitter = require('events').EventEmitter,
    ConsistentHashing = require('./utils/consistentHashing').ConsistentHashing,
    util         = require('util'),
    zookeeper    = require('node-zookeeper-client');

var NodeManager = function(addr){

  this.address = addr || 'localhost:2181'; 

  EventEmitter.call(this);

  this.zkClient = zookeeper.createClient(this.address);
  this.nodeRing = new ConsistentHashing();

}

NodeManager.prototype._ROOT_ZNODE = '/npush/servers';

NodeManager.protype._initZnode = function(cb){

};



util.inherits(NodeManager, EventEmitter);

exports.NodeManager = NodeManager;


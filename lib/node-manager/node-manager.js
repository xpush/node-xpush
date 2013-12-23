var events       = require('events'),
    util         = require('util'),
    zookeeper    = require('node-zookeeper-client'),

    constants    = require('./constants');
    ConsistentHashing = require('./consistent-hashing').ConsistentHashing;


var NodeManager = exports.NodeManager = function (addr) {

  this.address = addr || 'localhost:2181'; 

  events.EventEmitter.call(this);

  var self = this;
  this.nodeRing = new ConsistentHashing();
  this.zkClient = zookeeper.createClient(this.address);

  this.zkClient.once('connected', function () {

    self.zkClient.exists(
      constants.BASE_ZNODE_PATH,
      function (error, stat) {
        if (error) {
          console.log(error.stack);
          return;
        }
        
        if (!stat) {
          self.zkClient.create(
            constants.BASE_ZNODE_PATH,
            zookeeper.CreateMode.PERSISTENT,
            function (error) {
              if (error) {
                console.log('Failed to create node: %s due to: %s.', constants.BASE_ZNODE_PATH, error);
              } else {
                self._watchServerNodes();
              }
            }
          );    
       }else{
         self._watchServerNodes();
       }
    });
 
  });

  this.zkClient.connect();

};

util.inherits(NodeManager, events.EventEmitter);


NodeManager.prototype._watchServerNodes = function(){

  var self = this;
  this.zkClient.getChildren(
    constants.BASE_ZNODE_PATH,
    function (event) {
      console.log('Got watcher event: %s', event);
      self._watchServerNodes();
    },
    function (error, children, stat) {
      if (error) {
        console.log('Failed to listchildren of %s due to: %s.', path, error);
      }
      console.log(children);
      self.nodeRing = new ConsistentHashing(children);
    }
  );

};

NodeManager.prototype.getServerNode = function (key) {
  var serverNode = this.nodeRing.getNode(key);
  return serverNode;
}

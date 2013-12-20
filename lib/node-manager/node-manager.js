var events       = require('events'),
    util         = require('util'),
    zookeeper    = require('node-zookeeper-client'),

    ConsistentHashing = require('./consistent-hashing').ConsistentHashing;


var NodeManager = exports.NodeManager = function (addr) {

  this.address = addr || 'localhost:2181'; 

  EventEmitter.call(this);

  var self = this;
  this.nodeRing = new ConsistentHashing();
  this.zkClient = zookeeper.createClient(this.address);

  this.zkClient.once('connected', function () {
    self.zkClient.exists(
      self._ROOT_ZNODE_ROOT,
      function (error, stat) {
        if (error) {
          console.log(error.stack);
          return;
        }

        if (!stat) {
          self.zkClient.create(
            self._ROOT_ZNODE_ROOT,
            zookeeper.CreateMode.PERSISTENT,
            function (error) {
              if (error) {
                console.log('Failed to create node: %s due to: %s.', path, error);
              } else {
                self._watchServerNodes ();
              }
            }
          );    
       }
    });
  });

  this.zkClient.connect();

};

util.inherits(NodeManager, EventEmitter);

NodeManager.prototype._ROOT_ZNODE_ROOT = '/xpush/servers';

NodeManager.protype._watchServerNodes = function(){
  var self = this;
  this.zkClient.getChildren(
    this._ROOT_ZNODE_ROOT,
    function (event) {
      console.log('Got watcher event: %s', event);
    },
    function (error, children, stat) {
      if (error) {
        console.log('Failed to listchildren of %s due to: %s.', path, error);
        self._watchServerNodes();
      }
    }
  );

};



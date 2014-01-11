var events       = require('events'),
    util         = require('util'),
    zookeeper    = require('node-zookeeper-client'),
    async        = require('async'),

    constants    = require('./constants');
    ConsistentHashing = require('./consistent-hashing').ConsistentHashing;

function wait(msecs){
  var start = new Date().getTime();
  var cur = start;
  while(cur - start < msecs){
  cur = new Date().getTime();
  }
}


var NodeManager = exports.NodeManager = function (addr, isWatching, callback) {

  this.address = addr || 'localhost:2181'; 
  this.ready = false;

  events.EventEmitter.call(this);

  var self = this;

  this.nodeRing = new ConsistentHashing();

  this.zkClient = zookeeper.createClient(this.address);
  
  this.connected = false;
  this.connectionTryNum=0;

  this.zkClient.once('connected', function () {
    
    self.connected = true;

    /* 왜 아래 코드는 안될까? 
    var paths = [ '', constants.SERVERS_PATH, constants.META_PATH ];

    async.map(paths, self._initPath, function (err, results) {

      if(isWatching) self._watchServerNodes();
      self.ready = true;

      if(callback) callback();

    });
    */

    self._initPath('', function () {
    self._initPath(constants.SERVERS_PATH, function () {
    self._initPath(constants.META_PATH, function () {
      if(isWatching) self._watchServerNodes();
      self.ready = true;

      if(callback) callback();
    });
    });
    });

  });
  
  this.zkClient.connect();

  var connectTry = function(){
     
    if(!self.connected){
      if(self.connectionTryNum>3){
        throw new Error("Zookeeper server is dead");
      }else{
        self.connectionTryNum++;
        setTimeout(connectTry,2000);
      }
    }
  }
  connectTry();  

};

util.inherits(NodeManager, events.EventEmitter);

NodeManager.prototype.isReady = function () {
  return this.ready;
};

NodeManager.prototype._initPath = function (nodePath, callback) {

  console.log(nodePath +' ;;;;;;;;');
  var self = this;

  console.log(this.zkClient);


  self.zkClient.exists(
    constants.BASE_ZNODE_PATH+nodePath,
    function (error, stat) {
      if (error) {
        console.log(error.stack);
        return;
      }
        
      if (!stat) {
         self._createZnode(nodePath, callback);
       }else{
         if(callback) callback(null);
       }
   });

};

NodeManager.prototype._createZnode = function (nodePath, callback) {
  this.zkClient.create(
    constants.BASE_ZNODE_PATH + nodePath,
    zookeeper.CreateMode.PERSISTENT,
    function (error) {
      if (error) {
        console.log('Failed to create node: %s due to: %s.', constants.BASE_ZNODE_PATH+nodePath, error);
      } else {
        if(callback) callback(null, constants.BASE_ZNODE_PATH + nodePath );
      }
    }
  );

};

NodeManager.prototype.addServerNode = function (address, port, callback) {
  
  var self = this;
  
  this.zkClient.getChildren(
    constants.BASE_ZNODE_PATH + constants.SERVERS_PATH,
    function (error, nodes, stats) {
      if (error) {
        console.log(error.stack);
        callback(error);
        return;
      }
      
      var server = address + ':' + port;
      var isExisted = false;
      var names = [];
 
      for (var i = 0; i < nodes.length; i++ ){

        var addrAndPort = nodes[i].substr(nodes[i].indexOf('^')+1);
        
        if(server == addrAndPort){
          isExisted = true;
          break;
        }

        names.push( Number(nodes[i].substr(0, nodes[i].indexOf('^'))) );

      }

      if(!isExisted){

        var n = 10;
        if(names.length > 0){
          n = Math.max.apply(null, names) + Math.floor(Math.random() * (20 - 10 + 1)) + 10;
        }

        var nodePath = constants.SERVERS_PATH + '/' + n + '^' + server;

        self._createZnode(nodePath, callback);

      }else{
        if(callback) callback(null);
      }
      

    }
  );
};


NodeManager.prototype.removeServerNode = function (address, port, callback) {
  var self = this;

  this.zkClient.getChildren(
    constants.BASE_ZNODE_PATH + constants.SERVERS_PATH,
    function (error, nodes, stats) {
      if (error) {
        console.log(error.stack);
        return;
      }
      
      nodes.forEach(function(node){
        var n = node.split('^')[0];
        var s = node.split('^')[1];
        if( s === address+":"+port){
          self.zkClient.remove(constants.BASE_ZNODE_PATH + constants.SERVERS_PATH+"/"+node, -1 , function(err){
            if(err){
              console.log("remove node Error : "+ err);
            }
            callback(null);
          })
          
        }
      });
    }
  );
}


NodeManager.prototype._watchServerNodes = function () {

  var self = this;
  this.zkClient.getChildren(
    constants.BASE_ZNODE_PATH+constants.SERVERS_PATH,
    function (event) {
      console.log('  Got watcher event: %s', event);
      self._watchServerNodes();
    },
    function (error, children, stat) {
      if (error) {
        console.log('Failed to listchildren due to: %s.', error);
      }
      console.log('  server nodes : ' + children);
      self.nodeRing = new ConsistentHashing(children);
    }
  );

};

NodeManager.prototype.getServerNode = function (key) {
  var serverNode = this.nodeRing.getNode(key);
  return serverNode;
}

NodeManager.prototype.getServerNodeByName = function (name) {
  var serverNode = this.nodeRing.getNodeByName(name);
  return serverNode;
}

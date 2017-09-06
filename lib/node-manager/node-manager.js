var events = require('events'),
  util = require('util'),
  zookeeper = require('node-zookeeper-client'),
  shortId = require('shortid'),

  constants = require('./constants'),
  async = require('async'),
  ConsistentHashing = require('./consistent-hashing').ConsistentHashing;

function wait(msecs) {
  var start = new Date().getTime();
  var cur = start;
  while (cur - start < msecs) {
    cur = new Date().getTime();
  }
}

/**
 * 서버정보를 Zookeeper에 등록 후 watching 하면서 사용가능한 서버를 동적으로 관리하기 위한 모듈
 * @module
 * @name NodeManager
 */
var NodeManager = exports.NodeManager = function (addr, isWatching, callback) {

  this.address = addr || 'localhost:2181';
  this.ready = false;
  this.isWatching = isWatching;

  events.EventEmitter.call(this);

  var self = this;

  this.nodeRing = new ConsistentHashing();
  this.appInfos = {};
  this.servers = {};
  this.serverArray = [];
  this.appArray = [];

  this.connected = false;
  this.connectionTryNum = 0;

  this._connect(isWatching, callback);

  var connectTry = function () {

    if (!self.connected) {
      if (self.connectionTryNum > 3) {
        if (callback) callback('ERR-ZOOKEEPER', 'zookeeper - failed to connect to [' + self.address + ']');
      } else {

        if (self.connectionTryNum > 1) console.warn(' (init) ZOOKEEPER connection retry ' + (self.connectionTryNum - 1));
        self.connectionTryNum++;
        setTimeout(connectTry, 2000);
      }
    }
  };
  connectTry();
};


util.inherits(NodeManager, events.EventEmitter);

NodeManager.prototype._connect = function (isWatching, callback) {

  var self = this;

  this.zkClient = zookeeper.createClient(this.address, {retries: 2});

  this.zkClient.once('connected', function () {

    self.connected = true;

    // 주키퍼에 노드를 생성함. '/xpush/servers/meta/app/session'
    self._initPath('', function () {
      self._initPath(constants.SERVERS_PATH, function () {
        self._initPath(constants.META_PATH, function () {
          self._initPath(constants.META_PATH + constants.APP_PATH, function () {
            self._initPath(constants.META_PATH + constants.GW_SERVER_PATH, function () {

              if (isWatching) {
                self._watchServerNodes();
              }

              self._watchAppNodes();
              self.ready = true;

              if (callback) callback();
            });
          });
        });
      });
    });
  });

  this.zkClient.connect();
};

/**
 * User 정보가 있는지 확인 후에 있는 경우 수정한다. deviceId를 필수로 입력받아야 한다.
 * @name isReady
 * @function
 */
NodeManager.prototype.isReady = function () {
  return this.ready;
};

/**
 * Zookeeper에 nodePath가 있는지 확인 후 없는 경우 생성함.
 * @private
 * @name _initPath
 * @function
 * @param {string} nodePath - node path
 * @param {callback} done - 초기화 후 수행할 callback function
 */
NodeManager.prototype._initPath = function (nodePath, callback) {


// TODO server configuration 을 기본 값으로 만들어 줌 ( 없는 경우만, ) - max-connection, expired-time
  var self = this;

  self.zkClient.exists(
    constants.BASE_ZNODE_PATH + nodePath,
    function (error, stat) {
      if (error) {
        console.error(error.stack);
        return;
      }

      if (!stat) {
        self._createZnode(nodePath, callback);
      } else {
        if (callback) callback(null);
      }
    });

};

/**
 * Zookeeper에 node를 persistent 모드로 생성함.
 * @private
 * @name _createZnode
 * @function
 * @param {string} nodePath - node path
 * @param {callback} done - 초기화 후 수행할 callback function
 */
NodeManager.prototype._createZnode = function (nodePath, callback) {
  this.zkClient.create(
    constants.BASE_ZNODE_PATH + nodePath,
    zookeeper.CreateMode.PERSISTENT,
    function (error) {
      if (error) {
        console.error('Failed to create node: %s due to: %s.', constants.BASE_ZNODE_PATH + nodePath, error);
        if (callback) callback(error);
      } else {
        if (callback) callback(null, constants.BASE_ZNODE_PATH + nodePath);
      }
    }
  );
};

/**
 * Zookeeper에 node를 EPHEMERAL 모드로 생성함.
 * @private
 * @name _createEphemeralZnode
 * @function
 * @param {string} nodePath - node path
 * @param {data} data - node data
 * @param {callback} done - 초기화 후 수행할 callback function
 */
NodeManager.prototype._createEphemeralZnode = function (nodePath, data, callback) {

  var nodeData;

  if (data && !callback) {
    callback = data;
  } else if (data && callback) {
    nodeData = new Buffer(data);
  }

  this.zkClient.create(
    constants.BASE_ZNODE_PATH + nodePath,
    nodeData,
    zookeeper.CreateMode.EPHEMERAL,
    function (error) {


      if (error) {
        if (error.getCode() == zookeeper.Exception.NODE_EXISTS) {
          if (callback) callback(null, constants.BASE_ZNODE_PATH + nodePath, data);
        } else {
          console.error('Failed to create node: %s due to: %s.', constants.BASE_ZNODE_PATH + nodePath, error.getName());
          if (callback) callback(error);
        }


      } else {
        if (callback) callback(null, constants.BASE_ZNODE_PATH + nodePath, data);
      }
    }
  );
};

/**
 * Zookeeper에 node를 persistent 모드로 생성함.
 * @private
 * @name _createZnodeWithData
 * @function
 * @param {string} nodePath - node path
 * @param {object} - node에 저장할 data
 * @param {callback} callback - 초기화 후 수행할 callback function
 */
NodeManager.prototype._createZnodeWithData = function (nodePath, data, callback) {

  this.zkClient.create(
    constants.BASE_ZNODE_PATH + nodePath,
    new Buffer(data),
    zookeeper.CreateMode.PERSISTENT,
    function (error) {
      if (error) {
        console.error('Failed to create node: %s due to: %s.', constants.BASE_ZNODE_PATH + nodePath, error);
        if (callback) callback(error);
      } else {
        if (callback) callback(null, constants.BASE_ZNODE_PATH + nodePath);
      }
    }
  );
};

/**
 * Zookeeper에서 node를 삭제함
 * @private
 * @name _removeZnode
 * @function
 * @param {string} nodePath - node path
 * @param {callback} callback - 초기화 후 수행할 callback function
 */
NodeManager.prototype._removeZnode = function (nodePath, callback) {
  this.zkClient.remove(
    constants.BASE_ZNODE_PATH + nodePath,
    -1,
    function (err) {
      if (err) {
        console.error('Failed to remove node: %s due to: %s.', constants.BASE_ZNODE_PATH + nodePath, err);
        if (callback) callback(err);
      } else {
        if (callback) callback(null);
      }
    }
  );
};

/**
 * Zookeeper에서 node를 삭제함
 * @name addAppNode
 * @function
 * @param {string} appId - application id
 * @param {string} appNm - application name
 * @param {object} data - json
 * @param {callback} callback - 초기화 후 수행할 callback function
 */
NodeManager.prototype.addAppNode = function (appId, appNm, data, callback) {

  if (!appId) {
    appId = shortId.generate();
  }
  var appInfo = appId + '^' + appNm;
  var nodePath = constants.META_PATH + constants.APP_PATH + '/' + appInfo;
  data.id = appId;

  var self = this;

  self.zkClient.exists(
    constants.BASE_ZNODE_PATH + nodePath,
    function (error, stat) {
      if (error) {
        console.error(error.stack);
        return;
      }

      if (!stat) {
        self._createZnodeWithData(nodePath, JSON.stringify(data), callback);
      } else {
        if (callback) callback(null);
      }
    }
  );
};

/**
 * Zookeeper에서 서버 node를 등록함
 * @name addServerNode
 * @function
 * @param {config} address - 서버의 config
 * @param {replicas} port - 서버의 port
 * @param {callback} callback - 초기화 후 수행할 callback function
 */
NodeManager.prototype.addServerNode = function (config, replicas, callback) {

  var self = this;
  var address = config.host;
  var port =  config.port;
  var serverName = config.serverName;

  this.zkClient.getChildren(
    constants.BASE_ZNODE_PATH + constants.SERVERS_PATH,
    function (error, nodes, stats) {
      if (error) {
        console.error(error.stack);
        callback(error);
        return;
      }

      var server = address + ':' + port;
      var isExisted = false;
      var names = [];

      var existedPathName;

      for (var i = 0; i < nodes.length; i++) {

        var ninfo = nodes[i].split('^'); // 0: name, 1:ip&Port, 2: replicas

        if (server == ninfo[1]) { // address (1)
          existedPathName = nodes[i];
          isExisted = true;
          break;
        }

        if ( typeof names[inx] == 'number' ){
          names.push(Number(ninfo[0])); // server name (0)
        } else {
          names.push(ninfo[0]); // server name (0)
        }

      }

      if (!isExisted) {

        if( !serverName ){
          serverName = 10;
          if (names.length > 0) {
            var maxBefore = 0;
            for( var inx in names ){
              if ( typeof names[inx] == 'number' ){
                maxBefore = names[inx] ;
              }
            }

            serverName = maxBefore + Math.floor(Math.random() * (20 - 10 + 1)) + 10;
          }
        }

        var nodePath = constants.SERVERS_PATH + '/' + serverName + '^' + server;

        self._createEphemeralZnode(nodePath, replicas + "", callback);

      } else {
        if (callback) callback(null, constants.SERVERS_PATH + '/' + existedPathName, replicas);
      }
    }
  );
};

/**
 * Zookeeper에 node Data를 변경함
 * @private
 * @name _setNodeData
 * @function
 * @param {string} path - path
 * @param {data} data - node data
 * @param {callback} done - 초기화 후 수행할 callback function
 */
NodeManager.prototype._setNodeData = function (path, data, callback) {

  this.zkClient.setData(
    path,
    new Buffer(data + ""),
    function (error, stat) {
      if (error) {
        console.error('Failed to set node data: %s due to: %s.', path, error.getName());
        if (callback) callback(error);

      } else {
        if (callback) callback(null, path, data);
      }
    }
  );
};

/**
 * Zookeeper에서 서버 node를 삭제함
 * @name removeServerNode
 * @function
 * @param {string} address - 서버의 address
 * @param {number} port - 서버의 port
 * @param {callback} callback - 초기화 후 수행할 callback function
 */
NodeManager.prototype.removeServerNode = function (address, port, callback) {
  var self = this;

  this.zkClient.getChildren(
    constants.BASE_ZNODE_PATH + constants.SERVERS_PATH,
    function (error, nodes, stats) {
      if (error) {
        console.error(error.stack);
        return;
      }

      nodes.forEach(function (node) {
        var n = node.split('^')[0];
        var s = node.split('^')[1];
        if (s === address + ":" + port) {
          self._removeZnode(constants.SERVERS_PATH + "/" + node, function (err) {
            if (err) {
              if (callback) callback(err);
            } else {
              callback(null);
            }
          });
        }
      });
    }
  );
};

/**
 * Zookeeper에 등록된 서버 노드를 watching하여 변경이 있을 경우, 새로운 Consisstent Hash를 생성한다. /xpush/servers
 * @private
 * @name _watchServerNodes
 * @function
 */
NodeManager.prototype._watchServerNodes = function () {

  var self = this;
  this.zkClient.getChildren(
    constants.BASE_ZNODE_PATH + constants.SERVERS_PATH,
    function (event) {
      //console.log('  Got watcher event: ', event);
      self._watchServerNodes();
    },
    function (error, children, stat) {
      if (error) {

        console.warn('Failed to list children due to: %s.', error);
        if (error.getCode() == zookeeper.Exception.CONNECTION_LOSS) { // TODO 나중에 좀더 확인이 필요함!
          self.zkClient.close();
          self._connect(self.isWatching, function (err) {
            if (err) console.error(err);
          })
        }

      } else {

        var max = children.length;

        var nodeTask = function (taskId, value, callback) {

          self._getServerNode(children[taskId], function () {
            taskId++
            if (taskId < max) {
              function_array.splice(function_array.length - 1, 0, nodeTask);
            }
            callback(null, taskId, ++value);
          });
        };

        var startTask = function (callback) {
          self.servers = {};
          function_array.splice(function_array.length - 1, 0, nodeTask);
          callback(null, 0, 0);
        };

        var finalTask = function (taskId, value, callback) {
          callback(null, value);
        };

        var function_array = [startTask, finalTask];

        if (max > 0) {

          console.log('  [event] server nodes [' + max + '] : ' + children);

          async.waterfall(function_array, function (err, result) {
            this.serverArray = [];
            this.serverArray = children;
            self.nodeRing = new ConsistentHashing(self.servers);
          });
        } else {
          
          // reset nodeRing
          self.nodeRing = new ConsistentHashing();
          console.warn('  [event] server nodes [0] : NOT EXISTED');
        }
      }
    }
  );
};

/**
 * Zookeeper에 등록된 Application 노드를 watching하여 변경이 있을 경우 appInfos를 수정한다.
 * @private
 * @name _watchAppNodes
 * @function
 */
NodeManager.prototype._watchAppNodes = function () {

  var self = this;
  this.zkClient.getChildren(
    constants.BASE_ZNODE_PATH + constants.META_PATH + constants.APP_PATH,
    function (event) {
      //console.log('  Got app watcher event: %s', event);
      self._watchAppNodes();
    },
    function (error, children, stat) {
      if (error) {
        console.error('Failed to app list children due to: %s.', error);
      } else {

        var max = children.length;

        var nodeTask = function (taskId, value, callback) {

          self._getAppNode(children[taskId], function () {
            taskId++
            if (taskId < max) {
              function_array.splice(function_array.length - 1, 0, nodeTask);
            }
            callback(null, taskId, ++value);
          });
        };

        var startTask = function (callback) {
          function_array.splice(function_array.length - 1, 0, nodeTask);
          callback(null, 0, 0);
        };

        var finalTask = function (taskId, value, callback) {
          callback(null, value);
        };

        var function_array = [startTask, finalTask];

        if (max > 0) {
          async.waterfall(function_array, function (err, result) {
            this.appArray = [];
            this.appArray = children;
          });
        }

      }
    }
  );
};

/**
 * Zookeeper에서 서버 node 정보를 가져옴
 * @name _getServerNode
 * @function
 * @param {number} childPath - childPath
 * @param {callback} callback - 초기화 후 수행할 callback function
 */
NodeManager.prototype._getServerNode = function (childPath, cb) {
  var self = this;
  var path = constants.BASE_ZNODE_PATH + constants.SERVERS_PATH + '/' + childPath;

  var _w = function (event) {
    //NODE_DATA_CHANGED
    if (event.type == 3) {
      self._getServerNode(childPath);
    }
  };

  if (cb && self.serverArray.indexOf(childPath) > -1) {
    _w = undefined;
  }

  self.zkClient.getData(path,
    _w,
    function (error, data, stat) {

      if (error) {
        console.error('Fail retrieve server datas: %s.', error);
      } else {

        var replicas = 160;
        if (data !== undefined && data !== null) {
          replicas = data.toString('utf8');
        }

        self.servers[childPath] = childPath + "^" + replicas;

        if (self.serverArray.indexOf(childPath) < 0) {
          self.serverArray.push(childPath);
        }

        if (cb) {
          cb();
        } else {
          self.nodeRing = new ConsistentHashing(self.servers);
          //console.log(self.nodeRing);
        }
      }
    }
  );
};

/**
 * Zookeeper에서 app node 정보를 가져옴
 * @name _getAppNode
 * @function
 * @param {string} childPath - childPath
 */
NodeManager.prototype._getAppNode = function (childPath, cb) {
  var self = this;
  var path = constants.BASE_ZNODE_PATH + constants.META_PATH + constants.APP_PATH + '/' + childPath;

  var _w = function (event) {
    //NODE_DATA_CHANGED
    if (event.type == 3) {
      self._getAppNode(childPath);
    }
  };

  if (cb && self.appArray.indexOf(childPath) > -1) {
    _w = undefined;
  }

  self.zkClient.getData(path,
    _w,
    function (error, data, stat) {

      if (error) {
        console.error('Fail retrieve app datas: %s.', error);
      }

      var tmp = data.toString('utf8');
      var appDatas = JSON.parse(tmp);

      if (self.appArray.indexOf(childPath) < 0) {
        self.appArray.push(childPath);
      }

      self.appInfos[appDatas.id] = appDatas;

      if (cb) {
        cb();
      }
    }
  );
};

/**
 * Zookeeper에서 config node 정보를 가져옴
 * @name _getConfigNode
 * @function
 * @param {string} key - key
 */
NodeManager.prototype._getConfigNode = function (key, cb) {
  var self = this;
  var path = constants.BASE_ZNODE_PATH + constants.CONFIG_PATH + '/' + key;

  var _w = function (event) {
    //NODE_DATA_CHANGED
    if (event.type == 3) {
      self._getConfigNode(key, cb);
    }
  };

  self.zkClient.getData(path,
    _w,
    function (error, data, stat) {

      if (error) {

        if (error.name == "NO_NODE") {
          if (cb) {
            cb(configData);
          }
        } else {
          console.error(error);
        }
      }

      if (data) {

        var tmp = data.toString('utf8');
        var configData = JSON.parse(tmp);

        if (cb) {
          cb(configData);
        }

      } else {
        if (cb) {
          cb();
        }
      }
    }
  );
};

NodeManager.prototype.getServerNode = function (key) {
  return this.nodeRing.getNode(key);
};

NodeManager.prototype.getServerNodeByName = function (name) {
  return this.nodeRing.getNodeByName(name);
};

NodeManager.prototype.createPath = function (path, callback) {
  this._createZnode(path, callback);
};

NodeManager.prototype.createEphemeralPath = function (path, data, callback) {
  this._createEphemeralZnode(path, data, callback);
};

NodeManager.prototype.setNodeData = function (path, data, callback) {
  this._setNodeData(path, data, callback);
};

NodeManager.prototype.getNodeMap = function () {
  return this.nodeRing.getNodeMap();
};

NodeManager.prototype.removePath = function (path, callback) {
  this._removeZnode(path, callback);
};

NodeManager.prototype.getAppInfo = function (id) {
  return this.appInfos[id];
};

NodeManager.prototype.getAppInfos = function () {
  return this.appInfos;
};

NodeManager.prototype.getConfigInfo = function (key, cb) {
  return this._getConfigNode(key, cb);
};

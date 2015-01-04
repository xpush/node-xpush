var EventEmitter = require('events').EventEmitter;
var util = require('util');
var zookeeper    = require('node-zookeeper-client');

/** base znode for the xpush server lists. **/
var CONSTANTS = {
	CONFIG_PATH : '/config'
};

var ALL_EVENT_LISTEN_KEY = "41caa633d99dd3df7910951bc26fab7e";

/**
 * Zookeeper 를 이용해서 config 정보들을 관리하고 사용할 수 있는 모듈
 * @name Configure
 */
var Configure = function(){
	this._configureData = {};
	this._beforeConnected = []; // function, data
};
util.inherits(Configure, EventEmitter);

/**
 * Zookeeper Client를 지정해서 사용,
 * @public
 * @name setZKClient
 * @function
 * @param {object} client - Zookeeper client
 * @param {string} serviceName - Zookeeper 에서 사용될 root node 이름
 */
Configure.prototype.setZKClient = function(client, serviceName){
	var self = this;
	if(!client){
		return console.log("No Zookeeper Client in Configuration!");
	}
	if(!serviceName || serviceName.length < 1 ){
		return console.log("You must pass argument2(ServiceName)!");
	}

	if(serviceName[0] != '/') {serviceName = '/'+serviceName};

	this.serviceName = serviceName;
	this.basePath = this.serviceName + CONSTANTS.CONFIG_PATH;

	if(!self.zkClient){
		self.zkClient = client;
		self._init(true);
	}
};

Configure.prototype.setZKClientOnce = function(client, serviceName){
	var self = this;
	if(!client){
		return console.log("No Zookeeper Client in Configuration!");
	}
	if(!serviceName || serviceName.length < 1 ){
		return console.log("You must pass argument2(ServiceName)!");
	}

	if(serviceName[0] != '/') {serviceName = '/'+serviceName};

	this.serviceName = serviceName;
	this.basePath = this.serviceName + CONSTANTS.CONFIG_PATH;

	if(!self.zkClient){
		self.zkClient = client;
		self._init(false);
	}
};

/**
 * Zookeeper client 가 설정되면 connection유무를 판단하여 데이터들을 관리할 준비를 한다.
 * @private
 * @name _init
 * @function
 */
Configure.prototype._init = function(isWatching){
	var self = this;
	var state = self.zkClient.getState();

	if(state == zookeeper.State.SYNC_CONNECTED){
		self._initFullPath(function(){
			if(isWatching) self._globalWatchConfig();
		});
	}else{
		self.zkClient.once('connected', function () {
			self._initFullPath(function(){
				if(isWatching) self._globalWatchConfig();
        self._executeStack();
			});
			self.zkClient.once('disconnected', function(){
				console.log("Configuration Zookeeper disconnected!");
				self._init();
			});
		});
	}
}

/**
 * Zookeeper client 가 접속 되기 전에 뭔가 조작한다면 미리 예방해 둔다.
 * @private
 * @name _executeStack
 * @function
 */
Configure.prototype._executeStack = function(){
  var self = this;
  while(self._beforeConnected.length > 0 ){
    var item = self._beforeConnected.splice(0, 1)[0];
    console.log(item);
    switch(item.method){
      case "get":
        self.getConfig(item.k, item.cb);
      break;

			case "set":
				self.setConfig(item.k, item.v, item.cb);
			break;

			case "setOnce":
				self.setConfigOnce(item.k, item.v, item.cb);
			break;

      case "remove":
        self.deleteConfig(item.k, item.cb);
      break;
    }
  }
}

/**
 * Config 정보를 저장한다.
 * @public
 * @name setConfig
 * @function
 * @param {string} key - config key
 * @param {string} value - config value
 * @param {function} cb - 설정이 완료되면 에러 유무를 호출
 */
Configure.prototype.setConfig = function(key, value, cb){
	var self = this;
	var newPath = this.basePath + '/' + key;

  if(self.zkClient.getState() != zookeeper.State.SYNC_CONNECTED){
    return self._beforeConnected.push({method: "set" , cb: cb, k: key, v: value });
  	//return console.log('Fail set config data ( zookeeper is offline )');
  }
  console.log("============== setConfig");
  self.zkClient.exists(
    newPath,
    function (error, stat) {
      if (error) {
        console.log(error.stack);
        return;
      }

      if (!stat) {
        self._createZnodeWithData(newPath, JSON.stringify(value), function(err){
        	//self._configureData.key = value;
        	self._watchConfig(key);
        	if(cb) cb(err);
        });
      }else{
      	self.zkClient.setData(newPath, new Buffer( JSON.stringify(value) ), -1,
      		function(error, stat){
			    if (error) {
			        console.log(error.stack);
			        return;
			    }
	        	self._watchConfig(key);
			    if(cb) cb(error);
      		});
      }
    }
  );
};

Configure.prototype.setConfigOnce = function(key, value, cb){
	var self = this;
	var newPath = this.basePath + '/' + key;

	if(self.zkClient.getState() != zookeeper.State.SYNC_CONNECTED){
		return self._beforeConnected.push({method: "setOnce" , cb: cb, k: key, v: value });
	}
	self.zkClient.exists(
		newPath,
		function (error, stat) {
			if (error) {
				console.log(error.stack);
				return;
			}

			if (!stat) {
				self._createZnodeWithData(newPath, JSON.stringify(value), function(err){
					if(cb) cb(err);
				});
			}else{
				self.zkClient.setData(newPath, new Buffer( JSON.stringify(value) ), -1,
				function(error, stat){
					if (error) {
						console.log(error.stack);
						return;
					}
					if(cb) cb(error);
				});
			}
		}
	);
};

/**
 * Config 정보를 읽어온다.
 * @public
 * @name getConfig
 * @function
 * @param {string} key - config key
 * @param {function} cb - 읽어온 설정 정보를 건네준다.
 */
Configure.prototype.getConfig = function(key, cb){
	var self =	this;
  if(self.zkClient.getState() != zookeeper.State.SYNC_CONNECTED){
    return self._beforeConnected.push( {method: 'get', cb : cb, k: key} );
  }

  self.zkClient.getData(
    this.basePath+'/'+key,
    function (error, data, stat) {
      if(error){
				if( error.code == -101 ) { // Exception: NO_NODE[-101].
					// @ TODO do something?
				} else {
					console.error('Fail retrieve config data: %s.', error);
				}

				if(cb) cb();

      }else{
			  var tmp = data.toString('utf8');
	      var datas = JSON.parse(tmp);

	      if(cb) cb(datas);
			}
    }
  );
};

/**
 * Config 정보를 삭제한다.
 * @public
 * @name deleteConfig
 * @function
 * @param {string} key - config key
 * @param {function} cb - 삭제가 정상으로 종료되었는지 판단하여 호출.
 */
Configure.prototype.deleteConfig = function(key , cb){
	var self =	this;
  if(self.zkClient.getState() != zookeeper.State.SYNC_CONNECTED){
    return self._beforeConnected.push( {method: 'get', cb : cb, k: key} );
  }

	self._removeZnode(this.basePath+'/'+key, function(err){
		if(err){
	        console.log('Fail delete config data (%s) : %s.', key, error);
		}else{
			//delete self.configureData.key;
			if(cb) cb(err);
		}
	});
}

/**
 * 변경된 모든 config 정보를 수신한다.
 * @private
 * @name onAll
 * @function
 * @param {function} cb - config 설정이 모두 변경되면 호출
 */
Configure.prototype.onAll = function(cb){
  var self = this;
  var listeners = self.listeners(ALL_EVENT_LISTEN_KEY);
  var isExist = false;

  for(var i = 0 ; i < listeners.length; i++){
    var l = listeners[i];
    if(l == cb) {
      isExist = true;
      break;
    }
  }
  if(!isExist) self.on(ALL_EVENT_LISTEN_KEY,cb);
}

/**
 * Zookeeper 의 기본 노드를 생성한다.
 * @private
 * @name _initFullPath
 * @function
 * @param {function} cb - node 생성이 완료되면 호출
 */
Configure.prototype._initFullPath = function(cb){
	var self = this;
	  self._initPath(self.serviceName, function () {
	    self._initPath(self.serviceName + CONSTANTS.CONFIG_PATH, function () {
	    	if(cb)cb();
	    });
	  });
};

/**
 * Zookeeper 의 노드를 생성한다.
 * @private
 * @name _createZnode
 * @function
 * @param {string}	nodePath - 생성할 노드 정보
 * @param {function} cb - node 생성이 완료되면 호출
 */
Configure.prototype._createZnode = function (nodePath, callback) {
	var self = this;
	self.zkClient.create(
		nodePath,
		zookeeper.CreateMode.PERSISTENT,
		function (error) {
		  if (error) {
		    console.log('Failed to create node: %s due to: %s.', nodePath, error);
		    if(callback) callback(error);
		  } else {
		    if(callback) callback(null, nodePath );
		  }
		}
	);
};

/**
 * Zookeeper 의 노드를 생성한다.(없는 경우에만)
 * @private
 * @name _initPath
 * @function
 * @param {string}	nodePath - 생성할 노드 정보
 * @param {function} cb - node 생성이 완료되면 호출
 */
Configure.prototype._initPath = function (nodePath, callback) {
// TODO server configuration 을 기본 값으로 만들어 줌 ( 없는 경우만, ) - max-connection, expired-time
  var self = this;
  self.zkClient.exists(
    nodePath,
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

/**
 * Zookeeper 의 노드를 데이터와 함께 생성한다.
 * @private
 * @name _createZnodeWithData
 * @function
 * @param {string}	nodePath - 생성할 노드 정보
 * @param {json}	data - 생성한 노드에 저장할 데이터
 * @param {function} cb - node 생성이 완료되면 호출
 */
Configure.prototype._createZnodeWithData = function (nodePath, data, callback) {
	var self = this;
  self.zkClient.create(
    nodePath,
    new Buffer(data),
    zookeeper.CreateMode.PERSISTENT,
    function (error) {
      if (error) {
        console.log('Failed to create node: %s due to: %s.', nodePath, error);
        if(callback) callback(error);
      } else {
        if(callback) callback(null, nodePath );
      }
    }
  );
};

/**
 * Zookeeper 의 노드를 삭제한다.
 * @private
 * @name _removeZnode
 * @function
 * @param {string}	nodePath - 삭제할 노드 정보
 * @param {function} cb - node 삭제 완료되면 호출
 */
Configure.prototype._removeZnode = function (nodePath, callback) {
	var self = this;
  self.zkClient.remove(
    nodePath,
    -1,
    function (err) {
      if (err) {
        console.log('Failed to remove node: %s due to: %s.', nodePath, err);
        if(callback) callback(err);
      } else {
        if(callback) callback(null);
      }
    }
  );
};

/**
 * 최초에 모든 설정 정보를 Zookeeper 에서 watching 하기 시작한다.
 * @private
 * @name _globalWatchConfig
 * @function
 */
Configure.prototype._globalWatchConfig = function(){
	var self = this;

  this.zkClient.getChildren(
    this.basePath,
		function (event) {
			self._globalWatchConfig();
		},
    function(error, children, stat){
      if (error) {
        console.log('Failed to app list children due to: %s.', error);
      }else{
        for (var i = 0; i < children.length; i++) {
        	self._watchConfig(children[i]);
        }
      }
    }
    );
}

/**
 * Zookeeper에서 해당 key 에 해당되는 config 정보를 watching 한다.
 * @private
 * @name _watchConfig
 * @function
 * @param {string} key - config key
 */
Configure.prototype._watchConfig = function(key){
	var self = this;
	var newPath = this.basePath+'/'+key;
  this.zkClient.getData(
    newPath,
    function (event) {
      self._watchConfig(key);
    },
    function (error,  data, stat) {

      if (error) {

				if (error.code == -101){
					// @ TODO 백부석님 이거 어떻게 해야 할끼? do something ????
				} else {
					console.error('Failed to list children due to: %s.', error);
				}

      } else {

				var dataObject = JSON.parse( data );
				self.emit(key, dataObject );
				self.emit(ALL_EVENT_LISTEN_KEY, key, dataObject);

			}
    }
  );
}

/**
 * Zookeeper에서 모든 config정보의 key들을 가져온다.
 * @private
 * @name getConfigKeyList
 * @function
 * @param {function} cb - 모든 key값을 가져오면 호출한다.
 */
Configure.prototype.getConfigKeyList = function(cb){
  this.zkClient.getChildren(
    this.basePath,
    function(error, children, stat){
      if (error) {
        console.log('Failed to app list children due to: %s.', error);
      }else{
        cb(children);
      }
    }
    );
}

var config = new Configure();
module.exports = config;

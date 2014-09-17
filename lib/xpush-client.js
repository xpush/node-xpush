var io = require('socket.io-client'),
		http = require('http');

var SESSION = 'session';
var CHANNEL = 'channel';

var ST = {A:'app',C:'channel',U:'userId',US:'users',D:'deviceId',N:'notiId',S:'server'
,MG:'message',NM:'name',PW:'password',GR:'groups',DT:'datas',MD:'mode',TS:'timestamp'
,SS:'socketId',CD:'createDate',UD:'updateDate'};

var socketOptions ={
  transports: ['websocket']
  ,'force new connection': true
};

var RMKEY = 'message';

var XPush = exports.XPush = function(host, appId, eventHandler, autoInitFlag) {
  if(!host){alert('params(1) must have hostname'); return;}
  if(!appId){alert('params(2) must have appId'); return;}
  var self = this;
  self.appId = appId;       // applicationKey
  self._channels = {};      // channel List

  //self.initStatus;        // manage async problem
  self.headers = {};        // request header
  //self.liveSockets = {};  // ch : Connection
  self._sessionConnection;
  self.maxConnection = 5;
  self.maxTimeout = 30000;
  self.channelNameList = [];
  self.hostname = host;
  self.receiveMessageStack = [];
  self.isExistUnread = true;
  self.autoInitFlag = true;

  if( autoInitFlag !=undefined ){
    self.autoInitFlag = autoInitFlag;
  }

  self.on('newChannel',function(data){
    self.channelNameList.push( data.chNm );
  });

  if(eventHandler){
    self._isEventHandler = true;
    self.on('___session_event', eventHandler);
  }
  return self;
};

XPush.Context = {
  SIGNUP : '/user/register',
  LOGIN : '/auth',
  Channel : '/channel',
  Signout : '/signout',
  Message : '/msg',
  NODE : '/node'
};


/**
 * userId와 password를 이용하여 Login을 한다.
 * @name login
 * @memberof Xpush
 * @function
 * @param {string} userId - User Id
 * @param {string} password - Password
 * @param {string} [deviceId=WEB] - Device Id
 * @param {string} [mode] - mode
 * @param {callback} cb - 로그인 후 수행할 callback function
 * @example
 * 
 * xpush.login( 'james', '1234', function(err,data){
 *   console.log('register success : ', data);
 * });
 * @example
 * // login with deviceId
 * xpush.login( 'james', '1234', 'android', function(err,data){
 *   console.log('login success : ', data);
 * });
 */
XPush.prototype.login = function(userId, password, deviceId, mode, cb){
  var self = this;

  if(typeof(deviceId) == 'function' && !mode && !cb){
    cb = deviceId;
    deviceId = 'WEB';
  }

  if(typeof(mode) == 'function' && !cb){
    cb = mode;
  }

  self.userId = userId;
  self.deviceId = deviceId;
  var sendData = {A: self.appId, U: userId, PW: password, D: deviceId};
  if(mode) sendData.MD = mode;

  self.ajax( XPush.Context.LOGIN , 'POST', sendData, function(err, result){

    if(err){
      if(cb) cb(err, result);
      return;
    }

    if(result.status == 'ok'){
      // result.result = {"token":"HS6pNwzBoK","server":"215","serverUrl":"http://www.notdol.com:9990"};
      var c = self._sessionConnection = new Connection(self, SESSION, result.result);

      c.connect(function(){
        console.log("xpush : login end", self.userId);
        self._initSessionSocket(self._sessionConnection._socket, function(){
          if(cb) cb(result.message, result.result); // @ TODO from yohan.
        });
      });
    }else{
      if(cb) cb(result.message);
      alert('xpush : login error'+ result.message);
    }
  });
};

/**
 * 현재 xpush object 안의 channel 정보를 가져온다.
 * @name getChannel
 * @memberof Xpush
 * @function
 * @param {string} channel - Channel Id
 * @return {Object} return Channel Object
 * @example
 * var channel01 = xpush.getChannel('channel01');
 */
XPush.prototype.getChannel = function(channel){
  var self = this;
  var channels = self._channels;
  for(var k in channels){
    if(k == channel) return channels[k];
  }

  return undefined;
};

  /**
   * 연결할 channel server 정보를 가져온다.
   * @private
   * @function
   * @param {string} channel - Channel Id
   * @param {callback} cb - 획득 후 수행할 callback function
   */
  XPush.prototype._getChannelInfo = function(channel, cb){
    var self = this;
    console.log("xpush : _getChannelInfo ",channel);
    self.ajax( XPush.Context.NODE+'/'+self.appId+'/'+channel , 'GET', {}, cb);
  };


/**
 * 비동기로 channel 정보를 가져온다. channel 정보가 객체 안에 존재하지 않으면, channel 정보를 server에서 조회한다.
 * @memberof Xpush
 * @function
 * @param {string} channel - Channel Id
 * @param {callback} cb - 조회 후 수행할 callback function
 * @example
 * xpush._getChannelAsync( 'channel03', function(err, result){
 *   console.log( 'result : ', result);
 * });
 */
XPush.prototype._getChannelAsync = function(channel, cb){
  var self = this;
  var ch = self.getChannel(channel);
  if(!ch){
    self._channels[channel] = ch;
    ch = self._makeChannel(channel);
    self._getChannelInfo(channel,function(err,data){
      if(err){
        console.log(" == node channel " ,err);
        cb(err);
      }else if ( data.status == 'ok'){
        ch.setServerInfo(data.result, function(){
          cb(false, ch);
        });
      }
    });
  }else{
    cb(false, ch);
  }
};


/**
 * data를 전송한다.
 * @name send
 * @memberof Xpush
 * @function
 * @param {string} channel - Channel Id
 * @param {string} name - EventName
 * @param {Object} data - String or JSON object to Send
 * @example
 * xpush.send( 'ch01', 'message', {'MG':'Hello world'} );
 */
XPush.prototype.send = function(channel, name, data){
  var self = this;

  self._getChannelAsync(channel, function (err, ch){
    ch.send(name,data);
  });
};

/**
 * 새로운 `CHANNEL_ONLY` 채널을 생성한다.
 * @name createSimpleChannel
 * @memberof Xpush
 * @function
 * @param {string} channel - Channel Id
 * @param {Object} [userObj] - UserObject( U : userID, D : deviceId )
 * @param {callback} cb - 생성 후 수행할 callback function
 * @example
 * // create simple channel without userObject
 * xpush.createSimpleChannel('channel01', function(){
 *   console.log( 'create simple channel success' );
 * });
 * @example
 * // create simple channel with userObject
 * xpush.createSimpleChannel('channel02', {'U':'james','D':'WEB'}, function(){
 *   console.log( 'create simple channel success' );
 * });
 */
XPush.prototype.createSimpleChannel = function(channel, userObj, cb){
  var self = this;

  var ch = self._makeChannel(channel);
  self._getChannelInfo(channel,function(err,data){
    if(err){
      console.log(" == node channel " ,err);
      if(cb) cb(err);
    }else if ( data.status == 'ok'){

      if( typeof(userObj) == 'function' && !cb ){
        cb = userObj; userObj = undefined;
      }

      if(userObj){
        self.userId = userObj.U || 'someone';
        self.deviceId = userObj.D || 'WEB';
      }else {
        self.userId = 'someone';
        self.deviceId = 'WEB';
      }

      ch.info = data.result;
      ch._server = {serverUrl : data.result.server.url};
      ch.chNm = data.result.channel;

      ch.connect(function(){
        if(cb) cb();
      }, 'CHANNEL_ONLY');

    }
  });

};

/**
 * 채널이 연결이 되어 있으면 channel connection 객체를 반환하고, 그렇지 않으면 새로운 `Connection`을 만든다.
 * @private
 * @function
	 * @param {string} channel - Channel Id
 * @return {Connection} Connect Object
 */
XPush.prototype._makeChannel = function(channel){
  var self = this;
  console.log('xpush : connection _makeChannel ',channel);
  for( var key in self._channels ){
    if( key == channel && self._channels[key] != undefined && self._channels[key]._connected ){
      return self._channels[key];
    }
  }

  var ch = new Connection(self,CHANNEL);
  if(channel) {
    ch.channel = channel;
    self._channels[channel] = ch;
  }
  return ch;
};

/**
 * 연결할 channel server 정보를 가져온다.
 * @private
 * @function
 * @param {string} channel - Channel Id
 * @param {callback} cb - 획득 후 수행할 callback function
 */
XPush.prototype._getChannelInfo = function(channel, cb){
  var self = this;
  console.log("xpush : _getChannelInfo ",channel);
  self.ajax( XPush.Context.NODE+'/'+self.appId+'/'+channel , 'GET', {}, cb);
};

XPush.prototype.ajax = function( context, method, data, headers, cb){
  var self = this;

  if(typeof(headers) == 'function' && !cb){
    cb = headers;
    headers = undefined;
  }

	var options = {
		host: 'stalk-front-s01.cloudapp.net',
		port:8000,
		path: context,
		method: method
	};

	if( headers ){
		options.headers = headers;
	}

	console.log( options );
	var request = http.request( options, function(res) {

	  var result = '';
		res.setEncoding('utf8');
	  res.on("data", function(chunk) {    
	  	result = result + chunk;	  	
	  });

	  res.on("end", function() {
	  	var r = JSON.parse(result);
	  	console.log( r );
      if(r.status != 'ok'){
        cb(r.status,r.mesage);
      }else{
        cb(null,r);
      }	 
	  });

	}).on('error', function(e) {
		console.log( e );
	  //console.log("ajax error: " + e.message);
	  cb('',result);
	});
	
	if( method.toLowerCase() !== 'GET'.toLowerCase() ){
		request.write(data);
	}
	request.end();
}

  /**
   * event stack에 event와 function을 등록한다. 해당 function은 event가 발생시 호출된다.
   * @name on
   * @memberof Xpush
   * @function
   * @param {string} event key
   * @param {function} function
   * @example
   * xpush.on( 'message', function(channel, name, data){
   *   console.log( channel, name, data );
   * });
   */
  XPush.prototype.on = function(event, fct){
    var self = this;
    self._events = self._events || {};
    self._events[event] = self._events[event] || [];
    self._events[event].push(fct);
    /*
    if(event == RMKEY ){
      self.getUnreadMessage(function(err, data){
        if(data && data.length > 0 )
        for(var i = data.length ; i > 0; i--){
          data[i].message.data = JSON.parse(data[i].message.data);
          self.receiveMessageStack.shift([RMKEY,  data[i].message.data.channel, data[i].name,  data[i].message.data]);
          //self.emit(RMKEY,  data[i].message.data.channel, data[i].name,  data[i].message.data);
        }
        self.isExistUnread = false;
        for(var i = 0 ; i < self.receiveMessageStack.length;i++){
          self.emit.apply(self, self.receiveMessageStack[i]);
        }
      });
    };
    */
    /*
    if(event == RMKEY ){
      self.getUnreadMessage(function(err, data){
        console.log("================================= " ,data);
        self._events = self._events || {};
        self._events[event] = self._events[event] || [];
        self._events[event].push(fct);

        if(data && data.length > 0 )
        for(var i = data.length ; i > 0; i--){
          data[i].message.data = JSON.parse(data[i].message.data);
          receiveMessageStack.shift([RMKEY,  data[i].message.data.channel, data[i].name,  data[i].message.data]);
          //self.emit(RMKEY,  data[i].message.data.channel, data[i].name,  data[i].message.data);
        }

        self.isExistUnread = false;
      });
    }else{
      self._events = self._events || {};
      self._events[event] = self._events[event] || [];
      self._events[event].push(fct);
    }
    */
  };

  /**
   * event stack에 등록되어 있는 함수를 호출한다.
   * 읽지 않은 메세지가 존재하면, 초기화 중인 상태이므로 message가 오더라도 해당 event의 function을 즉시 발생시키지 않고 stack에 쌓는다.
   * @private
   * @memberof Xpush
   * @function
   * @param {string} event key
   */
  XPush.prototype.emit = function(event){
    var self = this;
    if(self.isExistUnread) {
      self.receiveMessageStack.push(arguments);
    }else{
      self._events = self._events || {};
      if( event in self._events === false  )  return;
      for(var i = 0; i < self._events[event].length; i++){
        console.log("xpush : test ",arguments);
        self._events[event][i].apply(this, Array.prototype.slice.call(arguments, 1));
      }
    }
  };  

/**
 * Represents a Connection
 * @module Connection
 * @constructor
 * @param {Xpush} Object - Xpush obejct
 * @param {string} type - 'session' or channel'
 * @param {string} server - Server Url to connect
 */
var Connection = function(xpush , type, server){

  this._xpush = xpush;
  this._server = server;
  this._type = type;
  if(this._type == SESSION){
    this.chNm = SESSION;
  }
  this._socketStatus; // disconnected, connected
  this._socket;
  this.checkTimer;
  this.info;
  this.messageStack = [];
  this.isFirtConnect = true;
  this._connected = false;
  this.timeout = 30000;

  //self.on('received', function(data){
    //self._xpush.calcChannel(self);
  //});
  return this;
};

/**
 * Check connectionTimeout
 * @name checkConnectionTimeout
 * @memberof Connection
 * @function
 * @param {string} b - Server Url to connect
 */
Connection.prototype.checkConnectionTimeout = function(b){
  var self = this;
  if(self.checkTimer) clearTimeout(self.checkTimer);

  if(b){
    self.checkTimer = setTimeout(function(){
      self._socket.disconnect();
    }, self.timeout);
  }
};

/**
 * Set server url and connect to the server.
 * @name setServerInfo
 * @memberof Connection
 * @function
 * @param {Object} info - Server Url to connect
 * @param {callback} cb - setServerInfoCallback
 */
Connection.prototype.setServerInfo = function(info,cb){
  console.log("xpush : setServerInfo ", info);
  var self = this;
  self.info = info;
  self._server = {serverUrl : info.server.url};
  self.chNm = info.channel;
  self.connect(function(){
    console.log("xpush : setServerInfo end ", arguments,self._xpush.userId, self.chNm);
    //self.connectionCallback();
    if(cb) cb();
  });
};

/**
 * Connect to the server.
 * @name setServerInfo
 * @memberof Connection
 * @function
 * @param {callback} cb - connectCallback
 * @param {string} mode - Optional. `CHANANEL_ONLY`
 */
Connection.prototype.connect = function(cb, mode){
  var self = this;
    var query =
      'A='+self._xpush.appId+'&'+
      'U='+self._xpush.userId+'&'+
      'D='+self._xpush.deviceId+'&'+
      'TK='+self._server.token;
      //'mode=CHANNEL_ONLY';

  if(self._type == CHANNEL){
    query =
      'A='+self._xpush.appId+'&'+
      'C='+self.chNm+'&'+
      'U='+self._xpush.userId+'&'+
      'D='+self._xpush.deviceId+'&'+
      'S='+self.info.server.name;

    if(mode){
      if(mode == 'CHANNEL_ONLY'){
        self._xpush.isExistUnread = false;
      }
      query = query +'&MD='+ mode;
    }
  }

  self._socket = io.connect(self._server.serverUrl+'/'+self._type+'?'+query, socketOptions);

  console.log( 'xpush : socketconnect', self._server.serverUrl+'/'+self._type+'?'+query);
  self._socket.on('connect', function(){
    console.log( 'channel connection completed' );
    while(self.messageStack.length > 0 ){
      var t = self.messageStack.shift();
      //.self.send(t.NM, t.DT);
      self._socket.emit('send', {NM: t.NM , DT: t.DT});
    }
    self._connected = true;
    if(!self.isFirtConnect) return;
    self.isFirtConnect = false;
    self.connectionCallback(cb);
  });

  self._socket.on('disconnect',function(){
    self._connected = false;
  });
};

/**
 * The function is occured when socket is connected.
 * @name connectionCallback
 * @memberof Connection
 * @function
 * @param {callback} cb - connectionCallback
 */
Connection.prototype.connectionCallback = function(cb){
  var self = this;
  console.log("xpush : connection ",'connectionCallback',self._type, self._xpush.userId,self.chNm);

  self._socket.on('message',function(data){
    console.log("xpush : channel receive ", self.chNm, data, self._xpush.userId);
    self._xpush.emit(RMKEY, self.chNm, RMKEY , data);
  });

  self._socket.on('system',function(data){
    console.log("xpush : channel receive system", self.chNm, data, self._xpush.userId);
    self._xpush.emit("system", self.chNm, "system" , data);
  });

  if(self._xpush._isEventHandler) {

    self._socket.on('_event',function(data){

      switch(data.event){
        case 'CONNECTION' :
          self._xpush.emit('___session_event', 'CHANNEL', data);
        break;
        case 'DISCONNECT' :
          self._xpush.emit('___session_event', 'CHANNEL', data);
        break;
      }

    });
  }

  if(cb)cb();
};

/**
 * Close the socket connection.
 * @name disconnect
 * @memberof Connection
 * @function
 */
Connection.prototype.disconnect = function(){
  console.log("xpush : socketdisconnect ", this.chNm, this._xpush.userId);
  this._socket.disconnect();
  //delete this._socket;
};

/**
 * If socket is connected, send data right away,
 * @name send
 * @memberof Connection
 * @param {string} name - Event name
 * @param {object} data - JSON data
 * @param {callback} cb - sendCallback
 * @function
 */
Connection.prototype.send = function(name, data, cb){
  var self = this;
  if(self._connected){
    self._socket.emit('send', {NM: name , DT: data});
  }else{
    self.messageStack.push({NM: name, DT: data});
  }
};

/**
 * If socket is connected, join the channel
 * @name joinChannel
 * @memberof Connection
 * @param {object} data - JSON data
 * @param {callback} cb - joinChannelCallback
 * @function
 */
Connection.prototype.joinChannel = function(param, cb){
  var self = this;
  if(self._socket.connected){
    self._socket.emit('join', param, function( data ){
      cb( data );
    });
  }
};

/**
 * Upload the stream
 * @name upload
 * @memberof Connection
 * @param {object} stream - stream object
 * @param {object} data - file info data ( 'orgName', 'name', 'type')
 * @param {callback} cb - uploadCallback
 * @function
 */
Connection.prototype.upload = function(stream, data, cb){
  var self = this;
  if(self._socket.connected){
    ss(self._socket).emit('file-upload', stream, data, cb);
  }
};

/**
 * Stack the function into event array. The function will excute when an event occur.
 * @name on
 * @memberof Connection
 * @function
 * @param {string} event key
 * @param {function} function
 */
Connection.prototype.on = function(event, fct){
 var self = this;
  self._events = self._events || {};
  self._events[event] = self._events[event] || [];
  self._events[event].push(fct);
};

/**
 * Remove the function at event array
 * @name off
 * @memberof Connection
 * @function
 * @param {string} event key
 * @param {function} function
 */
Connection.prototype.off = function(event, fct){
  var self = this;
  self._events = self._events || {};
  if( event in self._events === false  )  return;
  self._events[event].splice(self._events[event].indexOf(fct), 1);
};

/**
 * Apply the event
 * @name emit
 * @memberof Connection
 * @function
 * @param {string} event key
 */  
Connection.prototype.emit = function(event /* , args... */){
  var self = this;
  self._events = self._events || {};
  if( event in self._events === false  )  return;
  for(var i = 0; i < self._events[event].length; i++){
    self._events[event][i].apply(this, Array.prototype.slice.call(arguments, 1));
  }
};
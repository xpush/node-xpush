/*! xpush javascript library - v0.1.0 - 2014-09-21
* https://xpush.github.io
* Copyright (c) 2014 John Kim; Licensed MIT */
(function(){

  var XPush = (function() {
    var http, io;
    if (typeof module !== 'undefined' ) {
      http = require('http');
      io = require('socket.io-client');
    }

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
    
    /**
     * Xpush의 생성자
     * @module Xpush
     * @constructor
     * @param {string} host - 접속할 Session Server의 address
     * @param {string} appId - application id
     * @param {string} [eventHandler] - session event를 처리하기 위한 함수
     * @param {boolean} [autoInitFlag] - 자동 초기화 여부에 대한 flag
     * @example
     * // Create new Xpush Object
     * var xpush = new Xpush( 'http://stalk-front-s01.cloudapp.net:8000', 'sample' );
     * @example
     * // Create new Xpush Object with event Handler
     * var xpush = new Xpush( 'http://stalk-front-s01.cloudapp.net:8000', 'sample', function (type, data){
     *   console.log( " type : ", type );
     *   console.log( " data : ", data );
     * });
     */
    var XPush = function(host, appId, eventHandler, autoInitFlag){
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
     * userId와 password를 이용하여 회원가입을 한다.
     * @name signup
     * @memberof Xpush
     * @function
     * @param {string} userId - User Id
     * @param {string} password - Password
     * @param {string} [deviceId=WEB] - Device Id
     * @param {callback} cb - 회원가입 후 수행할 callback function
     * @example
     * // Add new user
     * xpush.signup( 'james', '1234', function(err,data){
     *   console.log('register success : ' + data);
     * }); 
     */
    XPush.prototype.signup = function(userId, password, deviceId, cb){
      var self = this;

      if(typeof(deviceId) == 'function' && !cb){
        cb = deviceId;
        deviceId = 'WEB';
      }

      var sendData = {A:self.appId , U: userId, PW: password, D: deviceId};
      self.ajax( XPush.Context.SIGNUP , 'POST', sendData, cb);
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
     * 현재 xpush 객체에 userId와 deviceId를 세팅한다. session socket이 이미 연결되어 있는 경우만 
     * @name setSessionInfo
     * @memberof Xpush
     * @function
     * @param {string} userId - User Id
     * @param {string} [deviceId] - Device Id
     * @param {callback} cb - 세팅 후 수행할 callback function
     * @example
     * // Set session info
     * xpush.setSessionInfo( 'james', function(){} );
     * @example
     * // Set session info with deviceId
     * xpush.setSessionInfo( 'james', 'WEB', function(){} );
     */
    XPush.prototype.setSessionInfo = function(userId, deviceId, cb){
      var self = this;

      if(typeof(deviceId) == 'function' && !cb){
        cb = deviceId;
        deviceId = 'WEB';
      }

      self.userId = userId;
      self.deviceId = deviceId;

      cb();
    };

    /**
     * session socket 과 channel socket의 연결을 끊는다.
     * @name logout
     * @memberof Xpush
     * @function
     * @example
     * // logout
     * xpush.logout();
     */
    XPush.prototype.logout = function(){
      var self = this;
      if( self != undefined ) {

        // Disconnect session connection
        if( self._sessionConnection != undefined  ){
          self._sessionConnection.disconnect();
        }

        // Disconnect channel connections
        if( self._channels != undefined  ){
          for( var key in self._channels ){
            if( self._channels[key]._connected ){
              self._channels[key].disconnect();
            }
          }
        }
      }      
    };

    /**
     * 새로운 channel을 생성한다.
     * @name createChannel
     * @memberof Xpush
     * @function
     * @param {string} users - channel에 포함될 userId의 배열
     * @param {string} [channel] - Channel Id
     * @param {Object} [datas] - 추가적인 channel 정보를 위한 JSON
     * @param {callback} cb - 생성 후 수행할 callback function
     * @example
     * // create random channel without data
     * xpush.createChannel(['james', 'notdol'], function(err, data){
     *   console.log( 'create channel success : ', data);
     * });
     * @example
     * // create a channel without data
     * xpush.createChannel(['james'], 'channel02', function(err,data){
     *   console.log( 'create channel success : ', data);
     * });
     * @example
     * // create a channel with data
     * xpush.createChannel(['james'], 'channel03', {'NM':'james'}, function(err,data){
     *   console.log( 'create channel success : ', data);
     * });
     */
    XPush.prototype.createChannel = function(users, channel, datas, cb){
      var self = this;
      var channels = self._channels;

      if( arguments.length === 3 ){
        // users, channel, cb
        if( typeof(arguments[1]) == 'string' && typeof(arguments[2]) == 'function' ){
          cb = datas;
          datas = {};
        } else if ( typeof(arguments[1]) == 'object' && typeof(arguments[2]) == 'function' ){
          cb = datas;
          datas = channel;
          channel = undefined;
        }
      } else if(typeof(channel) == 'function' && !datas && !cb){
        cb = channel; channel = undefined; datas = {};
      }

      var newChannel;
      var channelNm = channel;
      //var oldChNm = channelNm;

      //Add logined user if not in users
      if( users.indexOf(self.userId) < 0 ){
        users.push(self.userId);
      }

      self.sEmit('channel-create',{C: channel, U: users, DT:datas},function(err, result){
        //_id: "53b039e6a2f41316d7046732"
        //app: "stalk-io"
        //channel: "b14qQ6wI"
        //created: "2014-06-29T16:08:06.684Z"
        if(err && err != 'WARN-EXISTED') {
          if(cb){
            cb(err, result);
          }
        }
        channelNm = result.C || channelNm;
        self._getChannelInfo(channelNm,function(err,data){
          //channel , seq, server.channel,name,url

          if(err){
            console.log(" == node channel " ,err);
          }else if ( data.status == 'ok'){
            newChannel.setServerInfo(data.result);
            //newChannel.chNm = channelNm;
            channels[channelNm] = newChannel;
            //if(oldChNm){
            //  delete channels[oldChNm];
            //}
            if(cb)cb(null, channelNm);
          }
        });
      });
      newChannel = self._makeChannel(channelNm);
      return newChannel;
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
     * server에서 channel list를 조회한다.
     * @name getChannels
     * @memberof Xpush
     * @function
     * @param {callback} cb - 조회 후 수행할 callback function
     * @example
     * // Get channels
     * xpush.getChannels(function(err,datas){
     *   console.log( 'channels : ' + datas );
     * });
     */
    XPush.prototype.getChannels = function(cb){
      var self = this;
      console.log("xpush : getChannels ",self.userId);
      self.sEmit('channel-list',function(err, result){
        //app(A), channel(C), created(CD) , users(US)
        console.log("xpush : getChannels end ",result);
        ['A','C','CD','US'].forEach(function(item){
          UTILS.changeKey(result,item);
        });
        if(result.length > 0){
          result.forEach(function(r){
            ['D','N','U'].forEach(function(item){
              UTILS.changeKey(r.users,item);
            });
          });
        }
        cb(err,result);
      });
    };

    /**
     * server의 channel 정보를 수정한다.
     * @name updateChannel
     * @memberof Xpush
     * @function
     * @param {string} channel - Channel Id
     * @param {Object} query - mongo DB query 형태로 된 JSON
     * @param {callback} cb - 수정 후 수행할 callback function
     * // update channel
     * @example
     * xpush.updateChannel( 'channel02', { $set:{'DT':{'NM':'notdol1'}}}, function(err, result){
     *   console.log( 'result : ', result );
     * });
     */
    XPush.prototype.updateChannel = function(channel, query, cb){
      var self = this;
      var param = { 'A': self.appId, 'C': channel, 'Q' : query };
      self.sEmit('channel-update', param, function(err, result){
        //app(A), channel(C), created(CD) , users(US)
        console.log("xpush : channel-update end ",result);
        cb(err,result);
      });
    };

    /**
     * 현재 channel에 연결된 사용자가 있는 channel list를 redis에서 조회한다.
     * @name getChannelsActive
     * @memberof Xpush
     * @function
     * @param {Object} data - ( 'key': '' )
     * @param {callback} cb - 조회 후 수행할 callback function
     * @example
     * // Retrieve channels that start with channel
     * xpush.getChannelsActive( {'key':'channel*'}, function(results){
     *   console.log( 'results : ', results );
     * });
     */
    XPush.prototype.getChannelsActive = function(data, cb){ //data.key(option)
      var self = this;
      self.sEmit('channel-list-active',data, function(err, result){
        //app, channel, created
        cb(result);
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
     * server의 channel 정보를 조회한다.
     * @name getChannelData
     * @memberof Xpush
     * @function
     * @param {string} channel - Channel Id
     * @param {callback} cb - 조회 후 수행할 callback function
     * @example
     * xpush.getChannelData( channel, function(err,data){
     *   console.log( 'retrieve channel success : ', data);
     * });
     */
    XPush.prototype.getChannelData = function(channel, cb){
      var self = this;
      self.sEmit('channel-get', {C: channel, U: /*userId*/{} }, function(err, result){
        if(cb) cb(err,result);
      });
    };

    /**
     * channel에 Join한다.
     * @name joinChannel
     * @memberof Xpush
     * @function
     * @param {string} channel - Channel Id
     * @param {Object} param - JSON Data ( U, DT )
     * @param {callback} cb - 합류 후 수행할 callback function
     * @example
     * xpush.joinChannel( 'channel03', {'U':['notdol']}, function(result){
     *   console.log( 'result : ', result);
     * });
     */
    XPush.prototype.joinChannel = function(channel, param, cb){
      var self = this;
      self._getChannelAsync(channel, function (err, ch){
        ch.joinChannel( param, function( data ){
          cb( data );
        });
      });
    };

    /**
     * channel에서 나간다.
     * @name exitChannel
     * @memberof Xpush
     * @function
     * @param {string} channel - Channel Id
     * @param {callback} cb - 나간 후 수행할 callback function
     * @example
     * xpush.exitChannel( 'channel03', function(err, result){
     *   console.log( 'result : ', result);
     * });
     */
    XPush.prototype.exitChannel = function(channel, cb){
      var self = this;
      self.sEmit('channel-exit', {C: channel}, function(err, result){
        if(cb) cb(err,result);
      });
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
     * file DOM 객체를 이용하여 socket stream을 이용하여 file을 upload한다.
     * @name uploadStream
     * @memberof Xpush
     * @function
     * @param {string} channel - Channel Id
     * @param {Object} inputObj - JSON Objec( 'file' : file DOM Oject for upload, 'type' : '' )
     * @param {function} fnPrg - 업로도 진행 상황을 보여주기 위한 function
     * @param {callback} fnCallback - 업로드 완료 후 수행할 callback function
     * @example
     * var fileObj = document.getElementById('file');
     * xpush.uploadStream( 'channel03', {
     *   file: fileObj
     * }, function(data, idx){
     *   console.log( 'progress : ' + data );
     * }, function(data,idx){
     *   console.log( 'upload result : ' + data );
     * });
     */
    XPush.prototype.uploadStream = function(channel, inputObj, fnPrg, fnCallback){
      var self = this;

      self._getChannelAsync(channel, function (err, ch){

        var blobs   = [];
        var streams = [];

        for(var i=0; i<inputObj.file.files.length; i++){
          var file   = inputObj.file.files[i];
          var bufferSize = 128;

          // larger than 1M
          if( file.size > ( 1024 * 1024 ) ){
            bufferSize = 256;
          } else if ( file.size > ( 4 * 1024 * 1024 ) ){
            bufferSize = 512;
          }
          
          var size   = 0;
          streams[i] = ss.createStream({highWaterMark: bufferSize * 1024});
          blobs[i]   = ss.createBlobReadStream(file, {highWaterMark: bufferSize * 1024});

          blobs[i].on('data', function(chunk) {
            size += chunk.length;
            fnPrg(Math.floor(size / file.size * 100), i);
          });

          var _data = {};
          _data.orgName = file.name;
          if(inputObj.overwrite) _data.name = file.name;
          if(inputObj.type)      _data.type = inputObj.type;

          ch.upload(streams[i], _data, function(result){
            fnCallback(result, i);
          });
          blobs[i].pipe(streams[i]);
        }

      });
    };

    /**
     * file dom 객체가 지원되지 않는 mobile에서는 REST API를 이용하여 파일을 업로드한다.
     * @name uploadFile
     * @memberof Xpush
     * @function
     * @param {string} channel - Channel Id
     * @param {string} fileUri - 업로드할 fileUri
     * @param {Object} inputObj - JSON Objec( 'type' : '', 'name' : Original File name )
     * @param {function} fnPrg - 업로도 진행 상황을 보여주기 위한 function
     * @param {callback} fnCallback - 업로드 완료 후 수행할 callback function 
     * @example
     * xpush.uploadFile('channelId', 'content://media/external/images/media/636',
     * {type : 'image', name:'image.png' },
     * function ( data ){
     *   console.log( data );
     * },
     * function (data){
     *   console.log( data.response );
     * });
     */
    XPush.prototype.uploadFile = function(channel, fileUri, inputObj, fnPrg, fnCallback){
      var self = this;

      self._getChannelAsync(channel, function(err, ch){

        if(window.FileTransfer && window.FileUploadOptions){

          var url = ch._server.serverUrl+'/upload';

          var options = new FileUploadOptions();
          options.fileKey="post";
          options.chunkedMode = false;
          options.params = {
            'key1': 'VAL1',
            'key2': 'VAL2'
          };
          options.headers = {
            'XP-A': self.appId,
            'XP-C': channel,
            'XP-U': JSON.stringify({
              U: self.userId,
              D: self.deviceId
            }) //[U]^[D]^[TK] @ TODO add user token
          };
          options.headers['XP-FU-org'] = inputObj.name;
          if(inputObj.overwrite) options.headers['XP-FU-nm'] = inputObj.name;
          if(inputObj.type)      options.headers['XP-FU-tp'] = inputObj.type;

          var ft = new FileTransfer();
          if( fnPrg != undefined ){
            ft.onprogress = function(progressEvent) {
              if (progressEvent.lengthComputable) {
                var perc = Math.floor(progressEvent.loaded / progressEvent.total * 100);
                fnPrg( perc);
              }
            };
          }

          ft.upload(fileUri, encodeURI(url), function(data){
            fnCallback(data);
            //$scope.picData = FILE_URI;
            //$scope.$apply();
          }, function(e) {
              console.log("On fail " + e);
          }, options);

        }

      });
    };

    /**
     * 업로드 완료된 file의 url을 가져온다.
     * @name getFileUrl
     * @memberof Xpush
     * @function
     * @param {string} channel - Channel Id
     * @param {string} fileName - 업로드후 return 받은 파일의 name
     * @return {string} 파일을 다운로드 받을 수 있는 url
     * @example
     * var url = xpush.getFileUrl( 'channel03', data.result.name )
     */
    XPush.prototype.getFileUrl = function(channel, fileName){

      var self = this;
      var ch = self.getChannel(channel);

      var result = ch.info.server.url +
        '/download/' +
        ch._xpush.appId +
        '/'+ch.info.channel +
        '/'+ch._xpush.userId +
        '/'+ch._socket.io.engine.id +
        '/'+fileName;

      return result;
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

    XPush.prototype.calcChannel = function(ch){
      var self = this;
      if(self._channels.length >= self.maxConnection){
        self._deleteChannel(self._channels[self._channels.length-1]);
      }
      /*
      if(ch){
        if(self._channels[0] != ch){
          for(var i  = 1 ; i < self._channels.length ; i++){
            if( self._channels[i] == ch){
              self._channels.unshift( self._channels.splice(i,1));
            }
          }
        }
      }
      */
    };

    /**
     * channel socket의 연결을 끊은 후, 관리 중인 connection 객체에서 삭제한다.
     * @private
     * @function
     * @param {Object} channel - Channel Id
     */
    XPush.prototype._deleteChannel = function(channelObject){
      var self = this;
      for(var k in self._channels){
        if(self._channels[k] == channelObject){
          self._channels[k].disconnect();
          delete self._channels[k];
          break;
        }
      }
    };

    /**
     * channel이 존재하는지 확인 후, 결과를 반환한다.
     * @name isExistChannel
     * @memberof Xpush
     * @function
     * @param {string} channel - Channel Id
     * @return {boolean}
     * @example
     * var isExist = xpush.isExistChannel('channel03');
     */
    XPush.prototype.isExistChannel = function(channel){
      var self = this;
      for(var i = 0 ; i < self.channelNameList.length ; i++){
        if(self.channelNameList[i] == channel){
          return true;
        }
      }
      return false;
    };

    /**
     * server에서 사용자 list를 조회한다.
     * @name getUserList
     * @memberof Xpush
     * @function
     * @param {Object} [params] - param for search user.
     * @param {function} cb - 조회 후 수행할 callback function
     * @example
     * xpush.getUserList( {'page':{'num':1,'size':10} },function(err, users){
     *   console.log( users );
     * });
     */
    XPush.prototype.getUserList = function(params,  cb){
      if(typeof(params) == 'function'){
        cb = params;
        params = {};
      }
      params = params == undefined ? {}: params;
      var self = this;
      console.log("xpush : getUsertList ",params);
      self.sEmit('user-list' , params, function(err, result){
        if(cb) cb(err, result.users, result.count);
      });
    };

    /**
     * server에서 사용자 list를 조회한다. pageing 처리가 가능하다.
     * @name queryUser
     * @memberof Xpush
     * @function
     * @param {Object} _params - ( query, column )
     * @param {callback} cb - 조회 후 수행할 callback function
     * @example
     * var param = {query : {'DT.NM':'james'}, column: { U: 1, DT: 1, _id: 0 } };
     * xpush.queryUser( param, function( err, userArray, count ){
     *   console.log( userArray );
     * });
     */
    XPush.prototype.queryUser = function(_params,  cb){

      var self = this;

      if(!_params.query) {
        console.error('Query User', 'query is not existed.');
      };
      if(!_params.column) {
        console.error('Query User', 'column is not existed.');
      };

      var params = {
        query : _params.query,
        column: _params.column
      };

      if(_params.options) params['options'] = _params.options;

      console.log("xpush : queryUser ",params);

      self.sEmit('user-query' , params, function(err, result){
        if(cb) cb(err, result.users, result.count);
      });
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
     * server에서 읽지 않은 message를 조회한다.
     * 조회 후, `message-received` API를 호출하여 조회한 message를 삭제한다.
     * @name getUnreadMessage
     * @memberof Xpush
     * @function
     * @param {callback} cb - 조회 후 수행할 callback function
     * @example
     * xpush.getUnreadMessage( function(err, result){
     *   console.log( result );
     * });
     */
    XPush.prototype.getUnreadMessage = function(cb){
      var self = this;
      console.log("xpush : getUnreadMessage ",self.userId);
      self.sEmit('message-unread',function(err, result){
        //app, channel, created
        console.log("xpush : getUnreadMessage end ", result);
        if(result && result.length > 0){
          result.sort(UTILS.messageTimeSort);
        }
        self.isExistUnread = false;
        self.sEmit('message-received');
        cb(err, result);
      });
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
     * 서버에서 group에 포함된 사용자 list를 조회한다.
     * @name getGroupUsers
     * @memberof Xpush
     * @function
     * @param {string} groupId - 찾을 groupId
     * @param {callback} cb - 조회 후 수행할 callback function
     * @example
     * xpush.getGroupUsers( 'james', function( err, users ){
     *   console.log( users );
     * )};
     */
    XPush.prototype.getGroupUsers = function(groupId,cb){
      var self = this;
    if(typeof(arguments[0]) == 'function') {cb = arguments[0]; groupId = undefined;}
      groupId = groupId ? groupId : self.userId;
      self.sEmit('group-list',{'GR': groupId}, function(err,result){
        cb(err,result);
      });
    };

    /**
     * 하나 또는 다수의 사용자에 group id를 추가한다.
     * @name addUserToGroup
     * @memberof Xpush
     * @function
     * @param {string} [groupId] - userId
     * @param {array} userIds - 추가할 사용자들의 ID array
     * @param {callback} cb - 추가 후 수행할 callback function
     * @example
     * xpush.addUserToGroup( 'james', ['notdol','john'], function( err, result ){
     *   console.log( result );
     * )};
     */
    XPush.prototype.addUserToGroup = function(groupId, userIds, cb){
      var self = this;
      if(typeof(arguments[1]) == 'function') {cb = arguments[1]; userIds = groupId; groupId = undefined;}
      groupId = groupId ? groupId : self.userId;
      userIds = userIds ? userIds : [];
      self.sEmit('group-add',{'GR': groupId, 'U': userIds}, function(err,result){
        //app, channel, created
        cb(err,result);
      });
    };

    /**
     * user를 group에서 삭제한다.
     * @name removeUserFromGroup
     * @memberof Xpush
     * @function
     * @param {string} [groupId] - userId
     * @param {string} userId - 삭제할 user의 ID
     * @param {callback} cb - 삭제 후 수행할 callback function
     * @example
     * xpush.removeUserFromGroup( 'james', 'notdol', function( err, result ){
     *   console.log( result );
     * )};
     */
    XPush.prototype.removeUserFromGroup = function(groupId, userId, cb){
      var self = this;
      if(typeof(arguments[1]) == 'function') {cb = arguments[1]; userId = groupId; groupId = undefined;}
      groupId = groupId ? groupId : self.userId;

      self.sEmit('group-remove',{'GR': groupId, 'U': userId}, function(err, result){
        cb(err,result);
      });
    };

    /**
    XPush.prototype.getGroups = function(){
      // not defined yet
    };

    XPush.prototype.signout = function(cb){
      //session end
      var self = this;
      var sendData = { };
      self.ajax( XPush.Context.Signout , 'POST', sendData, cb);
    };
    */

    /**
     * session socket을 초기화 후에 event를 추가한다. `autoInitFlag`가 true면 channel 정보 및 읽지 않은 message를 조회한다.
     * @private
     * @function
     * @param {Object} socket.io
     * @param {callback} cb - 초기화 후 수행할 callback function
     */
    XPush.prototype._initSessionSocket = function(socket,cb){
      var self = this;
      socket.on('_event',function(data){
        console.log('xpush : session receive ', data.event, data.C,data.NM,data.DT, self.userId);
        // data.event = NOTIFICATION
        // channel,name, timestamp, data= {}
        switch(data.event){
          case 'NOTIFICATION':
            var ch = self.getChannel(data.C);

            // if `autoInitFlag` is true, make channel automatically
            if( self.autoInitFlag ){
              if(!ch){
                ch = self._makeChannel(data.C);

                self._getChannelInfo(data.C,function(err,data){

                  if(err){
                    console.log(" == node channel " ,err);
                  }else if ( data.status == 'ok'){
                    ch.setServerInfo(data.result);
                  }
                });
                //self.emit('channel-created', {ch: ch, chNm: data.channel});
                if(!self.isExistChannel(data.channel)) {
                  self.emit('newChannel', ch);
                }
              }
              ch.emit(data.NM , data.DT);
            }
            self.emit(data.NM, data.C, data.NM, data.DT);
          break;

          case 'CONNECT' :
            self.emit('___session_event', 'SESSION', data);
          break;

          case 'DISCONNECT' :
            self.emit('___session_event', 'SESSION', data);
          break;

          case 'LOGOUT' :
            self.emit('___session_event', 'LOGOUT', data);
          break;
        }

      });

      socket.on('channel',function(data){
        console.log('xpush : session receive ', 'channel', data, self.userId);

        switch(data.event){
          case 'UPDATE':
        // event: update , app,channel,server,count
          break;

          case 'REMOVE' :
        // event: remove , app,channel
          break;
        }
      });

      socket.on('connected',function(){
        console.log('xpush : session receive ', CHANNEL, arguments, self.userId);
      });

      // if `autoInitFlag` is true, get channels
      if( self.autoInitFlag ){
        self.getChannels(function(err,data){
          self.channelNameList = data;
          self.getUnreadMessage(function(err, data){
            if(data && data.length > 0 ){
              for(var i = data.length-1 ; i >= 0; i--){

                data[i].MG.DT = JSON.parse(data[i].MG.DT);
                self.receiveMessageStack.unshift([RMKEY,  data[i].MG.DT.C, data[i].NM,  data[i].MG.DT]);
                //self.emit(RMKEY,  data[i].message.data.channel, data[i].name,  data[i].message.data);
              }
              self.isExistUnread = false;
              while(self.receiveMessageStack.length > 0 ){
                var t = self.receiveMessageStack.shift();
                self.emit.apply(self, t );
              }
              if(cb) cb();
            }else{
              if(cb) cb();
            }
          });
        });
      } else {
        if(cb) cb();
      }

      socket.on('disconnect',function(){
        self.isExistUnread = true;
      });
    };

    var _rest = function( context, method, data, headers, cb){
      var self = this;

      if(typeof(headers) == 'function' && !cb){
        cb = headers;
        headers = undefined;
      }

      var hostname = self.hostname.replace( "http://", "" );
      if( hostname.indexOf( ":" ) > 0 ) hostname = hostname.split(":")[0];

      var options = {
        host: hostname,
        port:8000,
        path: context,
        method: method
      };

      if( headers ){
        options.headers = headers;
      } else {
         options.headers = {};
      }

      options.headers['Content-Type'] = 'application/json';      

      var result = '';
      var request = http.request( options, function(res) {

        res.setEncoding('utf8');
        res.on("data", function(chunk) {    
          result = result + chunk;      
        });

        res.on("end", function() {
          var r = JSON.parse(result);
          if(r.status != 'ok'){
            cb(r.status,r.mesage);
          }else{
            cb(null,r);
          }  
        });

      }).on('error', function(e) {
        console.log("ajax error: " + e.message);
        cb('',result);
      });
      
      if( method.toLowerCase() !== 'GET'.toLowerCase() ){
        request.write(JSON.stringify(data));
      }
      request.end();
    }

    var _ajax = function( context, method, data, headers, cb){
      var self = this;

      if(typeof(headers) == 'function' && !cb){
        cb = headers;
        headers = false;
      }

      var xhr;
      try{
        xhr = new XMLHttpRequest();
      }catch (e){
        try{
          xhr = new XDomainRequest();
        } catch (e){
          try{
            xhr = new ActiveXObject('Msxml2.XMLHTTP');
          }catch (e){
            try{
              xhr = new ActiveXObject('Microsoft.XMLHTTP');
            }catch (e){
              console.error('\nYour browser is not compatible with XPUSH AJAX');
            }
          }
        }
      }

      var _url = self.hostname+context;

      var param = Object.keys(data).map(function(k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(data[k]);
      }).join('&');

      method = (method.toLowerCase() == "get") ? "GET":"POST";
      param  = (param == null || param == "") ? null : param;
      if(method == "GET" && param != null){
        _url = _url + "?" + param;
      }

      xhr.open(method, _url, true);
      xhr.onreadystatechange = function() {

        if(xhr.readyState < 4) {
          return;
        }

        if(xhr.status !== 200) {
          console.log("xpush : ajax error", self.hostname+context,param);
          cb(xhr.status,{});
        }

        if(xhr.readyState === 4) {
          var r = JSON.parse(xhr.responseText);
          if(r.status != 'ok'){
            cb(r.status,r.mesage);
          }else{
            cb(null,r);
          }
        }
      };

      console.log("xpush : ajax ", self.hostname+context,method,param);

      if(headers) {
        for (var key in headers) {
          if (headers.hasOwnProperty(key)) {
            xhr.setRequestHeader(key, headers[key]);
          }
        }
      }
      xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
      xhr.send( (method == "POST") ? param : null);

      return;
    };

    if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
      XPush.prototype.ajax = _rest;
    } else {
      XPush.prototype.ajax = _ajax;
    }

    /**
     * session socket을 이용하여 event를 발생시킨다.
     * @private
     * @function
     * @param {string} socket의 event key
     * @param {Object} [params] - object to send
     * @param {callback} cb - event 발생 후 수행할 callback function
     */
    XPush.prototype.sEmit = function(key, params, cb){
      var self = this;

      var returnFunction = function(result){

        if(result.status == 'ok'){
          cb(null, result.result);
        }else{
          if(result.status.indexOf('WARN') == 0){
            console.warn("xpush : ", key, result.status, result.message);
          }else{
            console.error("xpush : ", key, result.status, result.message);
          }
          cb(result.status, result.message);
        }
      };

      if( typeof(arguments[1]) == 'function' ){
        cb = params;
        self._sessionConnection._socket.emit(key, returnFunction);
      }else{
        self._sessionConnection._socket.emit(key, params, returnFunction);
      }
      return;
    };

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
     * event stack에서 event와 function을 제거한다.
     * @name off
     * @memberof Xpush
     * @function
     * @param {string} event key
     * @param {function} function
     * @example
     * xpush.off( 'message', function(channel, name, data){
     *   console.log( channel, name, data );
     * });
     */
    XPush.prototype.off = function(event, fct){
      var self = this;
      self._events = self._events || {};
      if( event in self._events === false  )  return;
      self._events[event].splice(self._events[event].indexOf(fct), 1);
    };

    /**
     * event stack의 모든 event를 제거한다.
     * @name off
     * @memberof Xpush
     * @function
     * @param {string} event key
     * @param {function} function
     * @example
     * xpush.clearEvent();
     */
    XPush.prototype.clearEvent = function(){
      var self = this;
      self._events = {};
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

    var UTILS = {};

    UTILS.messageTimeSort = function(a,b){
      // created data
      return a.created > b.created;
    };

    UTILS.changeKey = function(data, key){
      if(data instanceof Array){
        data.forEach(function(d){
          d[ ST[key] ] = d[key];
          delete d[key];
        });
      }else{
        data[ ST[key] ] = data[key];
        delete data[key];
      }
    };

    return XPush;
  })();

  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = XPush;
  } else {
    if (typeof define === 'function' && define.amd) {
      define([], function() {
        return XPush;
      });
    } else {
      window.XPush = XPush;
    }
  }
})();
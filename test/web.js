// # XPUSH - API USAGE ( and samples )

var assert  = require("assert"),
    io      = require('socket.io-client'),
    restify = require('restify'),
    async   = require('async');

// Gateway Server 
//
// hosts 파일에 gateway.server 로 도메인 설정을 미리 해두어야 합니다
var gatewayServer = restify.createJsonClient({
  url: 'http://gateway.server:8000',
  version: '*'                
});

var socketOptions ={
  transports: ['websocket'],
  'force new connection': true
};

// 테스트 application 정보
var Application = {
  appNm: 'xpush-messenger' 
};

// 테스트 사용자 정보
var Users = {
  John: {
    userId : 'John'
  },
  Ally: {
    userId : 'Ally'
  },
  Lynn: {
    userId : 'Lynn'
  },
  Daniel: {
    userId : 'Daniel'
  }

};


// # Restful API 목록
var API = {

  // ## application 생성.
  // 
  // ### <code>POST</code> /app/create/ [App명]
  app_create: function (_appNm, callback) {
    gatewayServer.post( '/app/create/'+_appNm,
      function(err, req, res, data) {
        if( err ){
          console.log(err);
        }else{
          callback(data);
        }
      });
  },
  
  // ## Session Socket Server 주소 가져오기.
  // Gateway Server 로부터 User ID를 기준으로 Session Socket Server 주소를 가져 옵니다.
  //
  // ### <code>GET</code> /node/ [User ID]
  node_session: function (_userId, callback) {
    gatewayServer.get('/node/session/'+_userId, 
      function(err, req, res, data) {
        if( err ){
          console.log( err );
        } else {
          callback(data, _userId);
        }
      });
  },
  
  // ## Message Socket Server 주소 가져오기.
  // Gateway Server 로부터 App ID 와 Channel명을 기준으로 Message Socket Server 주소를 가져 옵니다.
  //
  // ### <code>GET</code> /node/ [App명] / [Channel명]
  node: function (_app, _channel, callback) {
    
    gatewayServer.get('/node/'+_app+'/'+_channel, 
      function(err, req, res, data) {
        
        if( err ){
          console.log( err );
        } else {
          
          callback(data);
        }
      });
  },
  
  // ## Message Socket Server 주소 가져오기.
  // Gateway Server 로부터 App ID 와 Channel명을 기준으로 Message Socket Server 주소를 가져 옵니다.
  //
  // ### <code>POST</code> /user/register
  user_register: function (_userId, callback) {

      // #### Parameters
      // - **app** : application ID <code>mandatory</code>
      // - **userId** : User ID <code>mandatory</code>
      // - **deviceType** : Client device type ( web / android / ios / desktop ) <code>mandatory</code>
      // - **deviceId** : Unique client device ID
      // - **notiId** : Notification ID
      // - **datas** : Addional Datas ( JSON Object )    
    var params = {
      app: Application.appId,
      userId: _userId,
      deviceType: 'web'
    };

    gatewayServer.post('/user/register', params, 
      function(err, req, res, data) {
        if( err ){
          console.log( err );
        } else {

          callback(data, _userId);
        }
      });
  }
  
};

// # 기능 구현하기.
var Library = {

  // ## 로그인하기.
  login: function(_userId, callback) {

    // Session Socket Server 주소 가져오기. ( /node/session/ [User ID] )
    API.node_session(Users[_userId].userId, function (data, _userId) {

      // Session Socket 연결하기
      Users[_userId].sessionSocket = io.connect(data.result.server, socketOptions);
      // Socket에 connect 이벤트 등록 ( connect 이벤트 발생 )
      Users[_userId].sessionSocket.on('connect', function() {
        
        // **login** 이벤트 호출 
        var param = {
          app: Application.appId,   // app : Application ID            
          server: data.result.name, // server : Session Socket Server 번호(아이디) 
          userId: _userId,          // userId : User ID
          deviceType: 'web'         // Client device type ( web / android / ios / desktop ) 
          // ( deviceType 이 'web' 인 경우, notiId는 넘기지 않습니다. 서버에서 자동 부여 됩니다.
        }; 
        
        Users[_userId].sessionSocket.emit('user-login', param, function (data) {
          
          Users[_userId].sessionId = data.result.sessionId;
          
          console.info('\t logined : '+JSON.stringify(data));
          callback(data);
        });

      });

      // Notification 이벤트 등록
      Users[_userId].sessionSocket.on('notification', function (data) {
        console.info('\t Notification : '+JSON.stringify(data));
      });

    });
  },

  // ## Channel 목록 가져오기.
  // User ID 가 포함되어 있는 모든 Channel 목록을 가져오기.
  // ( **user-login** 이벤트 호출 이후에 사용 가능 )
  channels: function(_userId, callback) {
    
    // **channal-list** 이벤트 호출
    var param = {
      app: Application.appId }; // app : Application ID

    Users[_userId].sessionSocket.emit('channel-list', param, function (data) {
        console.info('\t channels : '+JSON.stringify(data));
      callback(data);
    });
    
  },

  // ## Channel 생성하기.
  createChannel: function(_userId, _channel, _userIds, callback) {

    // **channel-create** 이벤트 호출
    var param = {
      app:      Application.appId,  // app : Application ID
      channel:  _channel,           // channel : channel ID
      users:    _userIds            // users : userId 배열, **생성자의 User ID도 포함**되어야 한다.
    };

    Users[_userId].sessionSocket.emit('channel-create', param, function (data) {
        console.info('\t create channel : '+JSON.stringify(data));
      callback(data);
    });

  },

  // ## Channel 참여하기.
  joinChannel: function(_userId, _channel, callback) {
    
    // Message Socket Server 주소 가져오기. ( /node/ [App ID] / [Channel ID] )
    API.node(Application.appId, _channel, function (data) {
      
      Users[_userId].messageSocket = io.connect(data.result.server, socketOptions);
      Users[_userId].messageSocket.on('connect', function() {
        
        // **channel-join** 이벤트 호출
        var param = {
          server:     data.result.name,   // server: Message Socket Server 명(번호)
          app:        Application.appId,  // app : Application ID
          channel:    _channel,           // channel : Channel ID
          userId:     _userId,            // userId : User ID
          sessionId:  Users[_userId].sessionId}; // sessionId : 로그인 했을때 생성된 session ID
        
        Users[_userId].messageSocket.emit('channel-join', param, function (data) {
          console.info('\t joined : '+JSON.stringify(data));
          callback(data);
        });

      });

      Users[_userId].messageSocket.on('message', function (data) {
        console.info('\t event was fired!! - Message : '+JSON.stringify(data));
      });

    });
  },
  
  // ## Channel 에서 나가기
  leaveChannel: function(_userId) {
    Users[_userId].messageSocket.disconnect();
  },
  
  // ## Channel 에 메시지 전송
  sendMessage: function(_userId, _channel, _name, _datas, callback) {
        
    // **channel-join** 이벤트 호출
    var param = {
      app:      Application.appId,  // app : Application ID
      channel:  _channel,           // channel : Channel ID
      name:     _name,              // name : 이벤트 발생 ID
      data:     _datas };           // data : 전송할 데이터

    Users[_userId].messageSocket.emit('data-send', param, function (data) {
      callback(data);
    });

  }

};

// ## Sample Application TEST !!! 

describe('xpush samples', function() {
  this.timeout(2000);

  before( function(done) {
    API.app_create(Application.appNm, function(data) {
      Application.appId = data.result.appId;
      done();
    });
  });

  describe('#registration()', function() {

    it('John', function(done) {
      API.user_register('John', function(data) {
        done();
      });
    });

    it('Ally', function(done) {
      API.user_register('Ally', function(data) {
        done();
      });
    });

    it('Lynn', function(done) {
      API.user_register('Lynn', function(data) {
        done();
      });
    });

    it('Daniel', function(done) {
      API.user_register('Daniel', function(data) {
        done();
      });
    });

  });

  describe('#login()', function() {

    it('John', function(done) {
      Library.login('John', function(result){
        done();
      });
    });

    it('Ally', function(done) {
      Library.login('Ally', function(result){
        done();
      });
    });

    it('Lynn', function(done) {
      Library.login('Lynn', function(result){
        done();
      });
    });

    it('Daniel', function(done) {
      Library.login('Daniel', function(result){
        done();
      });
    });

  });


  describe('#channels()', function() {

    it('John', function(done) {
      Library.channels('John', function(result){
        done();
      });
    });

    it('Ally', function(done) {
      Library.channels('Ally', function(result){
        done();
      });
    });

  });

  describe('#createChannel()', function() {

    it('John (with Ally and Lynn) ', function(done) {
      Library.createChannel('John', null, ['John', 'Ally', 'Lynn'], function(result){
        done();
      });
    });

    it('Ally (with Daniel and Lynn) ', function(done) {
      Library.createChannel('Ally', null, ['Ally', 'Daniel', 'Lynn'], function(result){
        done();
      });
    });

  });


  describe('#joinChannel()', function() {

    var _channelList = [];
    
    it('get the list of Ally\'s channels', function(done) {
      Library.channels('Ally', function(data){
        _channelList = data.result;
        
        console.log(_channelList[0]);
        console.log(_channelList[1]);
        done();
      });
    });

    it('John on channel-0 ', function(done) {
      Library.joinChannel('John', _channelList[0].channel, function(result){
        done();
      });
    });
    
    it('Ally on channel-0 ', function(done) {
      Library.joinChannel('Ally', _channelList[0].channel, function(result){
        done();
      });
    });
    
    it('Lynn on channel-0 ', function(done) {
      Library.joinChannel('Lynn', _channelList[0].channel, function(result){
        done();
      });
    });
    
    it('Ally on channel-1 ', function(done) {
      Library.leaveChannel('Ally');
      Library.joinChannel('Ally', _channelList[1].channel, function(result){
        done();
      });
    });
    
    it('Lynn on channel-1 ', function(done) {
      Library.leaveChannel('Lynn');
      Library.joinChannel('Lynn', _channelList[1].channel, function(result){
        done();
      });
    });

    it('get the list of Ally\'s channels again', function(done) {
      
      var _temp_channelId = _channelList[0].channel;  
      Library.channels('Ally', function(data){
        _channelList = data.result;
        console.log(_channelList[0]);
        console.log(_channelList[1]);
        done();
      });
    });
    
  });
  
  
  describe('#sendMessage()', function() {

    var _channelList = [];
    
    it('get the list of Ally\'s channels', function(done) {
      Library.channels('Ally', function(data){
        _channelList = data.result;
        done();
      });
    });
    
    it('Ally send a string message on channel-1 ', function(done) {
      var message = 'This is xpush sample testcase. This is String messages.';
      Library.sendMessage('Ally', _channelList[1].channel, 'message', message, function(result){
        done();
      });
    });
    
    it('Ally send a JSON message on channel-1 ', function(done) {
      var message = {title: 'Hello xpush sample', body: 'This is json sample !!! '};
      Library.sendMessage('Ally', _channelList[1].channel, 'message', message, function(result){
        done();
      });
    });
    
  });

});

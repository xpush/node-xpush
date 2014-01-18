// # XPUSH - API USAGE
// 메신져 개발에 필요한 시나리오를 따라서 restful API 호출과 Socket 이벤트에 대해 기술하였다.
//
// Sample 이므로, 다양한 xpush library 개발 시 참조할 수 있다.

var assert  = require("assert"),
    io      = require('socket.io-client'),
    restify = require('restify'),
    async   = require('async');

// Gateway Server 
//
// 테스트 하기 전에 hosts 파일에 gateway.server 로 도메인 설정을 미리 해두어야 합니다
var gatewayServer = restify.createJsonClient({
  url: 'http://gateway.server:8000',
  version: '*'                
});

var socketOptions ={
  transports: ['websocket'],
  'force new connection': true
};

// 테스트 application 정보
//
// 테스트 app 이름은 'xpush-messenger' 이다.
var Application = {
  appNm: 'xpush-messenger' 
};

// 테스트 사용자 정보들 (4명)
//
// 편의를 위하여 userId 를 간단하게 표기하였다.
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


// ### Restful API 목록
var API = {

  // #### application 생성.
  // App 명을 URL 에 포함하여 아플리케이션을 생성한다. 
  //
  // ##### <code>POST</code> /app/create/ [App명]
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
  
  // #### Session Socket Server 주소 가져오기.
  // Gateway Server 로부터 User ID를 기준으로 Session Socket Server 주소를 가져 옵니다.
  //
  // ##### <code>GET</code> /node/ [User ID]
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
  
  // #### Message Socket Server 주소 가져오기.
  // Gateway Server 로부터 App ID 와 Channel명을 기준으로 Message Socket Server 주소를 가져 옵니다.
  //
  // ##### <code>GET</code> /node/ [App명] / [Channel명]
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
  
  // #### Message Socket Server 주소 가져오기.
  // Gateway Server 로부터 App ID 와 Channel명을 기준으로 Message Socket Server 주소를 가져 옵니다.
  //
  // ##### <code>POST</code> /user/register
  user_register: function (_userId, callback) {

      // ##### Parameters
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

// ### 기능 구현 목록
var Library = {

  // #### 로그인하기.
  login: function(_userId, callback) {

    // Session Socket Server 주소 가져오기. ( /node/session/ [User ID] )
    API.node_session(Users[_userId].userId, function (data, _userId) {

      // Session Socket 연결하기
      Users[_userId].sessionSocket = io.connect(data.result.server, socketOptions);
      // Socket에 connect 이벤트 등록 ( connect 이벤트 발생 )
      Users[_userId].sessionSocket.on('connect', function() {
        
        // **login** 이벤트 호출 
        var param = {
          app: Application.appId,   // - app : Application ID            
          server: data.result.name, // - server : Session Socket Server 번호(아이디) 
          userId: _userId,          // - userId : User ID
          deviceType: 'web'         // - devideType : Client device type ( web / android / ios / desktop ) 
          // notiId : notification key  ( deviceType 이 'web' 인 경우, notiId는 넘기지 않습니다. 서버에서 자동 부여 됩니다.)
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

  // #### Channel 목록 가져오기.
  // User ID 가 포함되어 있는 모든 Channel 목록을 가져오기.
  //
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

  // #### Channel 생성하기.
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

  // #### Channel 참여하기.
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
  
  // #### Channel 에서 나가기
  leaveChannel: function(_userId) {
    Users[_userId].messageSocket.disconnect();
  },
  
  // #### Channel 에 메시지 전송
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

// ### 테스트 하기.
// 실제 다수의 사용자가 xpush-messenger 에 로그인하고 대화 하는 시나리오대로 정상 동작하는지 테스트 하는 코드.
describe('xpush samples', function() {
  this.timeout(2000);

  // #### 어플리케이션 등록
  // 테스트 시작하기 전에 신규 어플리케이션을 생성한다.
  before( function(done) {
    API.app_create(Application.appNm, function(data) {
      // app ID 는 전역 변수에 저정해둔다. (다음 과정에서 사용해야 함)
      Application.appId = data.result.appId;
      done();
    });
  });

  // ##### 사용자 등록
  // user ID 가 John, Ally, Lynn, Daniel 인 사용자를 신규 등록한다. ( deviceType 은 모두 'web')
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

  // ##### 사용자 로그인 
  // 4명 모두 로그인한다.
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

  // ##### Channel 목록을 가져오기. 
  // 사용자가 등록되어 있는 Channel 목록을 모두 가져온다.
  describe('#listchannels()', function() {

    // John 의 channel 목록 가져오기
    it('John', function(done) {
      Library.channels('John', function(result){
        done();
      });
    });

    // Ally 의 channel 목록 가져오기
    it('Ally', function(done) {
      Library.channels('Ally', function(result){
        done();
      });
    });
    
    // 초기에는 목록에 아무 channel 도 없다.

  });

  // ##### Channel 생성하기. 
  // 신규 Channel을 생성한다.
  describe('#createChannel()', function() {

    // John 은 Ally 와 Lynn 과 함께 Channel 을 생성한다.
    it('John (with Ally and Lynn) ', function(done) {
      // Channel 명을 null 이나 '' 으로 넘기면, 자동 생성된된다.
      //
      // 사용자 목록에는 userId 가 배열로 들어가며, 반드시 생성한 사용자의 userId 도 포함해야만 한다.
      Library.createChannel('John', null, ['John', 'Ally', 'Lynn'], function(result){
        done();
      });
    });
    
    // Ally 은 Daniel 와 Lynn 과 함께 Channel 을 생성한다.
    it('Ally (with Daniel and Lynn) ', function(done) {
      Library.createChannel('Ally', null, ['Ally', 'Daniel', 'Lynn'], function(result){
        done();
      });
    });

  });


  // ##### Channel에 참여하기.
  // 메시지 전송 전용 socket 연결을 새로 한다. (session socket 과는 구별됨)
  describe('#joinChannel()', function() {

    var _channelList = [];
    
    // 체널에 참여하기 전에, Ally 의 channel 목록을 가져온다.
    it('get the list of Ally\'s channels', function(done) {
      Library.channels('Ally', function(data){
        _channelList = data.result;
        
        console.log(_channelList[0]);
        console.log(_channelList[1]);
        
        done();
      });
    });

    // John 는 첫번째 channel 에 참여한다.
    it('John on channel-0 ', function(done) {
      Library.joinChannel('John', _channelList[0].channel, function(result){
        done();
      });
    });
    
    // Ally 는 첫번째 channel 에 참여한다.
    it('Ally on channel-0 ', function(done) {
      Library.joinChannel('Ally', _channelList[0].channel, function(result){
        done();
      });
    });
    
    // Lynn 는 첫번째 channel 에 참여한다.
    it('Lynn on channel-0 ', function(done) {
      Library.joinChannel('Lynn', _channelList[0].channel, function(result){
        done();
      });
    });
    
    it('Ally on channel-1 ', function(done) {
      // Ally 는 현재 체널에서 나온다.
      //
      // ( 메시지 전용 socket 연결을 끊는다. )
      Library.leaveChannel('Ally');
      // Ally 는 두번째 channel 에 참여한다.
      Library.joinChannel('Ally', _channelList[1].channel, function(result){
        done();
      });
    });
    
    it('Lynn on channel-1 ', function(done) {
      // Lynn 는 현재 체널에서 나온다.
      Library.leaveChannel('Lynn');
      // Lynn 는 두번째 channel 에 참여한다.
      Library.joinChannel('Lynn', _channelList[1].channel, function(result){
        done();
      });
    });

    // Ally 의 channel 목록 내용이 어떻게 변경되었는지 확인해본다.
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
  
  
  // ##### 메시지 송신하기.
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

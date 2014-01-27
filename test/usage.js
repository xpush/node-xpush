// # XPUSH - API USAGE
// 메신져 개발에 필요한 시나리오를 따라서 restful API 호출과 Socket 이벤트에 대해 기술하였다.
//
// Sample 이므로, 다양한 xpush library 개발 시 참조할 수 있다.

var assert  = require("assert"),
    io      = require('socket.io-client'),
    restify = require('restify'),
    async   = require('async');

// Session Server. 
//
// 테스트 하기 전에 hosts 파일에 session.server 로 도메인 설정을 미리 해두어야 합니다
var sessionServer = restify.createJsonClient({
  url: 'http://session.server:8000',
  version: '*'                
});

var socketOptions ={
  transports: ['websocket'],
  'force new connection': true
};

// 테스트 application 정보.
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
    userId : 'John',
    password: 'test',
    deviceId: 'web'
  },
  Ally: {
    userId : 'Ally',
    password: 'test',
    deviceId: 'android-1234567890',
    notiId: 'android-nnnnnnnnnnnnn'
  },
  Lynn: {
    userId : 'Lynn',
    password: 'test',
    deviceId: 'web'
  },
  Daniel: {
    userId : 'Daniel',
    password: 'test',
    deviceId: 'web'
  }

};


// ### Restful API 목록
var API = {

  // #### application 생성.
  // App 명을 URL 에 포함하여 아플리케이션을 생성한다. 
  //
  // ##### <code>PUT</code> /app/ [App명]
  app_create: function (_appNm, callback) {
    sessionServer.put( '/app/'+_appNm,
      function(err, req, res, data) {
        
        if( err ){
          
          console.log(err);
        }else{
          callback(data);
        }
      });
  },
  
  // #### Message Socket Server 주소 가져오기.
  // Session Server 로부터 App ID 와 Channel명을 기준으로 Message Socket Server 주소를 가져 옵니다.
  //
  // ##### <code>POST</code> /user/register
  register: function (_userId, callback) {

      // ##### Parameters
      // - **app** : application ID <code>mandatory</code>
      // - **userId** : User ID <code>mandatory</code>
      // - **deviceType** : Client device type ( web / android / ios / desktop ) <code>mandatory</code>
      // - **deviceId** : Unique client device ID
      // - **notiId** : Notification ID
      // - **datas** : Addional Datas ( JSON Object )    
    var params = {
      app: Application.appId,
      userId: Users[_userId].userId,
      password: Users[_userId].password,
      deviceId: Users[_userId].deviceId,
      notiId: Users[_userId].notiId,
      datas: {name: Users[_userId].userId, email: Users[_userId].userId+'@xpush.io' }
    };

    sessionServer.post('/user/register', params, 
      function(err, req, res, data) {
        if( err ){
          console.log( err );
        } else {

          callback(data, _userId);
        }
      });
  },
  
  // #### Session Socket Server 주소 가져오기.
  // Session Server 로부터 App ID와 User ID를 기준으로 Session Socket Server 주소를 가져 옵니다.
  //
  // ##### <code>GET</code> /session/ [App ID] / [User ID]
  auth: function (_userId, callback) {
    
    var params = {
      app: Application.appId,
      userId: Users[_userId].userId,
      password: Users[_userId].password,
      deviceId: Users[_userId].deviceId
    };   
    
    sessionServer.post('/auth', params,
      function(err, req, res, data) {
        if( err ){
          console.log( err );
        } else {
          callback(data, _userId);
        }
      });
  },
  
  // #### Message Socket Server 주소 가져오기.
  // Session Server 로부터 App ID 와 Channel명을 기준으로 Message Socket Server 주소를 가져 옵니다.
  //
  // ##### <code>GET</code> /node/ [App명] / [Channel명]
  node: function (_app, _channel, callback) {
    
    sessionServer.get('/node/'+_app+'/'+_channel, 
      function(err, req, res, data) {
        
        if( err ){
          console.log( err );
        } else {
          
          callback(data);
        }
      });
  }
  
};

// ### 기능 구현 목록
var Library = {

  // #### 로그인하기.
  connect_session_socket: function(_userId, callback) {

    // Session Socket Server 주소 가져오기. ( /node/session/ [User ID] )
    API.auth(Users[_userId].userId, function (data, _userId) {
      
      var query = 
    	'app='+Application.appId+'&'+
			'userId='+Users[_userId].userId+'&'+
    	'deviceId='+Users[_userId].deviceId+'&'+
    	'token='+data.result.token;
      
      // Session Socket 연결하기.
      Users[_userId].sessionSocket = io.connect(data.result.serverUrl+'/session?'+query, socketOptions);
      // Socket에 connect 이벤트 등록 ( connect 이벤트 발생 )
      Users[_userId].sessionSocket.on('connect', function() {
        console.log(data);
        callback();
      });

      // Notification 이벤트 등록.
      Users[_userId].sessionSocket.on('NOTIFICATION', function (data) {
        console.info('\t NOTIFICATION ('+_userId+') :  - '+JSON.stringify(data));
      });

    });
  },

  // #### Channel 목록 가져오기.
  // User ID 가 포함되어 있는 모든 Channel 목록을 가져오기.
  //
  // ( **user-login** 이벤트 호출 이후에 사용 가능 ).
  channels: function(_userId, callback) {
    
    // **channal-list** 이벤트 호출.

    Users[_userId].sessionSocket.emit('channel-list', function (data) {
        console.info('\t channels : '+JSON.stringify(data));
      callback(data);
    });
    
  },

  // #### Channel 생성하기.
  createChannel: function(_userId, _channel, _userIds, callback) {

    // **channel-create** 이벤트 호출
    var param = {
      channel:  _channel,           // channel : channel ID
      users:    _userIds            // users : userId 배열, **생성자의 User ID도 포함**되어야 한다.
    };

    Users[_userId].sessionSocket.emit('channel-create', param, function (data) {
        console.info('\t create channel : '+JSON.stringify(data));
      callback(data);
    });

  },

  // #### Channel 참여하기.
  connect_channel_socket: function(_userId, _channel, callback) {
    
    // Message Socket Server 주소 가져오기. ( /node/ [App ID] / [Channel ID] )
    API.node(Application.appId, _channel, function (data) {
      
      var query = 
    	'app='+Application.appId+'&'+
      'channel='+data.result.channel+'&'+
      'server='+data.result.server+'&'+
			'userId='+Users[_userId].userId+'&'+
    	'deviceId='+Users[_userId].deviceId;
      

      Users[_userId].messageSocket = io.connect(data.result.serverUrl+'/channel?'+query, socketOptions);
      Users[_userId].messageSocket.on('connect', function() {
        
        console.log(data);
        callback();
        
      });

      Users[_userId].messageSocket.on('message', function (data) {
        console.info('\t MESSAGE ('+_userId+') : '+JSON.stringify(data));
      });

    });
  },
  
  // #### Channel 에서 나가기.
  leaveChannel: function(_userId) {
    Users[_userId].messageSocket.disconnect();
  },
  
  // #### Channel 에 메시지 전송.
  sendMessage: function(_userId, _channel, _name, _datas, callback) {
        
    // **channel-join** 이벤트 호출.
    var param = {
      app:      Application.appId,  // app : Application ID
      channel:  _channel,           // channel : Channel ID
      name:     _name,              // name : 이벤트 발생 ID
      data:     _datas };           // data : 전송할 데이터

    Users[_userId].messageSocket.emit('send', param, function (data) {
      callback(data);
    });

  },

  unReadMessage: function(_userId, callback) {
    Users[_userId].messageSocket.emit('message-unread', function (data) {
      console.info('\t UNREAD MESSAGE ('+_userId+') : '+JSON.stringify(data));
      callback(data);
    });

  },

  unReadMessageWithChannel: function(_userId, _channel, callback) {
    Users[_userId].sessionSocket.emit('message-unread', {channel: _channel}, function (data) {
      console.info('\t UNREAD MESSAGE ('+_userId+') : '+JSON.stringify(data));
      callback(data);
    });

  },


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
  // user ID 가 John, Ally, Lynn, Daniel 인 사용자를 신규 등록한다. ( deviceType 은 모두 'web').
  describe('#register users()', function() {
	
    it('John', function(done) {
      API.register('John', function(data) {
        done();
      });
    });

    it('Ally', function(done) {
      API.register('Ally', function(data) {
        done();
      });
    });

    it('Lynn', function(done) {
      API.register('Lynn', function(data) {
        done();
      });
    });

    it('Daniel', function(done) {
      API.register('Daniel', function(data) {
        done();
      });
    });

  });

  // ##### 사용자 로그인. 
  // 4명 모두 로그인한다.
  describe('#connect session sockets()', function() {

    it('John', function(done) {
      Library.connect_session_socket('John', function(result){
        done();
      });
    });

    it('Ally', function(done) {
      Library.connect_session_socket('Ally', function(result){
        done();
      });
    });

    it('Lynn', function(done) {
      Library.connect_session_socket('Lynn', function(result){
        done();
      });
    });

    it('Daniel', function(done) {
      Library.connect_session_socket('Daniel', function(result){
        done();
      });
    });

  });


  // ##### Channel 목록을 가져오기. 
  // 사용자가 등록되어 있는 Channel 목록을 모두 가져온다.
  describe('#listchannels()', function() {

    // John 의 channel 목록 가져오기.
    it('John', function(done) {
      Library.channels('John', function(result){
        done();
      });
    });

    // Ally 의 channel 목록 가져오기.
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


	var _channelList = [];

  // ##### Channel에 참여하기.
  // 메시지 전송 전용 socket 연결을 새로 한다. (session socket 과는 구별됨)
  describe('#connect_channel_socket()', function() {

    
    
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
      Library.connect_channel_socket('John', _channelList[0].channel, function(result){
        done();
      });
    });
    
    // Ally 는 첫번째 channel 에 참여한다.
    it('Ally on channel-0 ', function(done) {
      Library.connect_channel_socket('Ally', _channelList[0].channel, function(result){
        done();
      });
    });
    
    // Lynn 는 첫번째 channel 에 참여한다.
    it('Lynn on channel-0 ', function(done) {
      Library.connect_channel_socket('Lynn', _channelList[0].channel, function(result){
        done();
      });
    });
    
    it('Ally on channel-1 ', function(done) {
      // Ally 는 현재 체널에서 나온다.
      //
      // ( 메시지 전용 socket 연결을 끊는다. )
      Library.leaveChannel('Ally');
      // Ally 는 두번째 channel 에 참여한다.
      Library.connect_channel_socket('Ally', _channelList[1].channel, function(result){
        done();
      });
    });
    
    it('Lynn on channel-1 ', function(done) {
      // Lynn 는 현재 체널에서 나온다.
      Library.leaveChannel('Lynn');
      // Lynn 는 두번째 channel 에 참여한다.
      Library.connect_channel_socket('Lynn', _channelList[1].channel, function(result){
        done();
      });
    });

    // Ally 의 channel 목록 내용이 어떻게 변경되었는지 확인해본다.
    it('get the list of Ally\'s channels again', function(done) {
      
      Library.channels('Ally', function(data){
        console.log(data.result[0]);
        console.log(data.result[1]);
        done();
      });
    });
    
  });
  // ##### 메시지 송신하기.
	// channel-0 : John 만 있음
	//
	// channel-1 : Ally 와 Lynn 이 있음
  describe('#sendMessage()', function() {

    
    it('get the list of Ally\'s channels', function(done) {
      Library.channels('Ally', function(data){
        console.log(data.result[0]);
        console.log(data.result[1]);
        done();
      });
    });
    
		// Ally 는 channel-1 에 메시지 전송
		//
		// : Ally/Lynn 에게 메시지 전송되고,  Daniel 에게 Notification !! 
    it('Ally send a string message on channel-1 ', function(done) {
      var message = 'This is xpush sample testcase. This is String messages.';
      Library.sendMessage('Ally', _channelList[1].channel, 'message', message, function(result){
        done();
      });
    });
    
		// Ally 는 channel-1 에 JSON 메시지 전송
		//
		// : Ally/Lynn 에게 JSON 메시지 전송되고,  Daniel 에게 Notification !!
    it('Ally send a JSON message on channel-1 ', function(done) {
      var message = {title: 'Hello xpush sample', body: 'This is json sample !!! '};
      Library.sendMessage('Ally', _channelList[1].channel, 'message', message, function(result){
        done();
      });
    });
		
		// John 은 channel-0 에 메시지 전송
		//
		// : John 본인에게 메시지 전송되고,  Ally/Lynn 에게 Notification !!
    it('John send a JSON message on channel-0 ', function(done) {
      var message = {title: 'Hello xpush sample', body: 'This is json sample !!! '};
      Library.sendMessage('John', _channelList[0].channel, 'message', message, function(result){
        done();
      });
    });
		
		// Notification 왔는지 확인하기 위해 1.5초 대기.
    it('wait for 1.5 sec. ', function(done) {
			setTimeout(done, 1500);
    });
    
  });
  // ##### 메시지 송신하기.
  describe('#sendMessage()', function() {
		
    it('Ally on channel-0 ', function(done) {
      // Ally 는 현재 체널에서 나온다.
      //
      // ( 메시지 전용 socket 연결을 끊는다. )
      Library.leaveChannel('Ally');
      // Ally 는 첫번째 channel 에 참여한다.
      Library.connect_channel_socket('Ally', _channelList[0].channel, function(result){
        done();
      });
    });
    
    it('Lynn on channel-0 ', function(done) {
      // Lynn 는 현재 체널에서 나온다.
      Library.leaveChannel('Lynn');
      // Lynn 는 첫번째 channel 에 참여한다.
      Library.connect_channel_socket('Lynn', _channelList[0].channel, function(result){
        done();
      });
    });
		
		// Ally 는 channel-0 에 JSON 메시지 전송
		//
		// 모두 즉시 전송되고 notification 없음!
    it('Ally send a JSON message on channel-1 ', function(done) {
      var message = {title: 'Hello xpush sample', body: 'This is json sample !!! '};
      Library.sendMessage('Ally', _channelList[0].channel, 'message', message, function(result){
        done();
      });
    });


    it('wait for 0.5 sec. ', function(done) {
      setTimeout(done, 500);
    });

    it('Ally\'s unread messages .', function(done) {
      Library.unReadMessage('Ally', function(result){
        done();
      });
    });

    it('Ally\'s unread messages (from sessionSocket).', function(done) {
      Library.unReadMessageWithChannel('Ally', _channelList[0].channel, function(result){
        done();
      });
    });

  });

  
  describe('#end()', function() {
    // 1.5초 대기 후 테스트 종료.
    it('wait for 1.5 sec. ', function(done) {
      setTimeout(done, 1500);
    });
  });
});

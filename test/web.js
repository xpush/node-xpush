var assert  = require("assert"),
    io      = require('socket.io-client'),
    restify = require('restify'),
    async   = require('async');


var gatewayServer = restify.createJsonClient( {
  url: 'http://gateway.server:8000',
  version: '*'                
});

var socketOptions ={
  transports: ['websocket'],
  'force new connection': true
};


var Application = {
  appNm: 'xpush-messenger' 
};


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
  Danial: {
    userId : 'Danial'
  }

};


var API = {

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
  node: function (_app, _channel, callback) {
    gatewayServer.get('/node/'+_app+'/'+_channel, 
      function(err, req, res, data) {
        if( err ){
          console.log( err );
        } else {
          callback(data);
          done();
        }
      });
  },
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
  user_register: function (_userId, callback) {

    var params = {
      app: Application.appId,
      userId: _userId,
      deviceType: 'WEB',
      deviceId: 'V1'
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

var Library = {

  login: function(_userId, callback) {

    API.node_session(Users[_userId].userId, function (data, _userId) {

      Users[_userId].sessionSocket = io.connect(data.result.server, socketOptions);
      Users[_userId].sessionSocket.on('connect', function() {
        
        var param = {
          app: Application.appId,
          userId: _userId,
          server: data.result.name };

        Users[_userId].sessionSocket.emit('login', param, function (data) {
          console.info('\t logined : '+JSON.stringify(data));
          callback(data);
        });

      });

      Users[_userId].sessionSocket.on('notification', function (data) {
        console.info('\t Notification : '+JSON.stringify(data));
      });

    });
  },

  channels: function(_userId, callback) {

    var param = {
      app: Application.appId,
      userId: _userId};

    Users[_userId].sessionSocket.emit('channels', param, function (data) {
        console.info('\t channels : '+JSON.stringify(data));
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

    it('Danial', function(done) {
      Library.login('Danial', function(result){
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

});

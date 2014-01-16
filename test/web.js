var assert  = require("assert"),
    io      = require('socket.io-client'),
    restify = require('restify');

var gatewayServer = restify.createJsonClient( {
  url: 'http://gateway.server:8000',
  version: '*'                
});

var socketOptions ={
  transports: ['websocket'],
  'force new connection': true
};

describe('Web Client', function() {
  this.timeout(3000);

  var appId = '';

  var apiServers = {};
  var clients = {};

  before( function(done) {

    gatewayServer.post(
      '/app/create/xpush-messenger-sample',
      function(err, req, res, data) {
        if( err ){
          console.log( err );
        } else {
          appId = data.appId;
          done();
        }
      }
    );
/*
    gatewayServer.get(
      '/app/list',
      function(err, req, res, data) {
        if( err ){
          console.log( err );
        } else {
          for (var app in data.result) {
            appId = app.appId;
            console.log( app.appNm +' is selected. ');
            done();
          }
        }
      }
    );
*/
  });

  describe('#login() - JohnKim', function() {

    it('get Api Server URL', function(done) {

      gatewayServer.get('/node/session/JohnKim', 
        function(err, req, res, data) {
          if( err ){
            console.log( err );
          } else {

            console.log(data);
            apiServer.url1 = data.result; 

            clients.socket1 = io.connect(apiServer.server, socketOptions);

          }
          done();
        });
    });

    it('login with JohnKim', function(done) {

      clients.socket1.on('connect', function(data){

        var param = {
          app: appId,
          userId: 'JohnKim',
          server: apiServer.name };

        clients.socket1.emit('login', param, function (data) {
          console.log(data);
          done();
        });

      });
      
    });

    it('get the list of JohnKim\'s channels', function (done) {
      

    });

  });

  describe('#createChannel()', function() {
    it('should create the new channel', function() {
    });
  });

});

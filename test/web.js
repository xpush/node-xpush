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
var socket;

describe('Web Client', function() {
  this.timeout(5000);

  var apiServer = {};

  describe('#login()', function() {

    it('should retrieve the address of the API server.', function(done) {

      gatewayServer.get('/node/session/JohnKim', 
        function(err, req, res, data) {
          if( err ){
            console.log( err );
          } else {

            console.log(data);
            apiServer = data.result; 

          }
          done();
        });
    });

    it('should login and connect socket connection for notification.', function(done) {

      socket = io.connect(apiServer.server, socketOptions);
      socket.on('connect',function(data){
        console.log(data);
        //socket.emit('connection name',chatUser1);
      });

      
    });
  });

  describe('#createChannel()', function() {
    it('should create the new channel', function() {
    });
  });

});

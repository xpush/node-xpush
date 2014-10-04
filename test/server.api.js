var xpush    = require('../lib/xpush');

describe('XPUSH API', function(){

  var X_SESSION_SERVER;
  var X_CHANNEL_SERVERS = [];
  var config = {};

  before(function(){

    config.home = './_xpush';
    config.host = '127.0.0.1';

  });

  after(function(){
  });


  describe("#startServer()", function() {

    this.timeout(10000);

    it("session server (port:8888)", function(done) {
      config.port= '8888';
      X_SESSION_SERVER      = xpush.createSessionServer(config, done);
    });

    it("channel server (port:9001)", function(done) {
      config.port= '9001';
      X_CHANNEL_SERVERS.push( xpush.createChannelServer(config, done) );
    });

    it("session server (port:9002)", function(done) {
      config.port= '9002';
      X_CHANNEL_SERVERS.push( xpush.createChannelServer(config, done) );
    });

    it("session server (port:9003)", function(done) {
      config.port= '9003';
      X_CHANNEL_SERVERS.push( xpush.createChannelServer(config, done) );
    });

  });


  describe("#check", function() {

    it("API method : API name ", function(done) {
      console.log(' - - - - - - - - - ');
      done();
    });

  });


});

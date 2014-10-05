var xpush    = require('../lib/xpush');
var assert  = require('assert');

var io = require( '../node_modules/socket.io/node_modules/socket.io-client' );
var http = require( 'http' );

describe('XPUSH API', function(){

  var X_SESSION_SERVER;
  var X_CHANNEL_SERVERS = [];
  var config =   {
    "zookeeper": {
      "address": "127.0.0.1:2181"
    },
    "redis": {
      "address": "127.0.0.1:6379"
    },
    "mongodb": {
      "address": "127.0.0.1:27017"
    }
  };

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
    /**
    it("channel server (port:9001)", function(done) {
      config.port= '9001';
      X_CHANNEL_SERVERS.push( xpush.createChannelServer(config, done) );
    });
    */

    /**
    it("channel server (port:9002)", function(done) {
      config.port= '9002';
      X_CHANNEL_SERVERS.push( xpush.createChannelServer(config, done) );
    });

    it("channel server (port:9003)", function(done) {
      config.port= '9003';
      X_CHANNEL_SERVERS.push( xpush.createChannelServer(config, done) );
    });
    */
  });


  describe("#check", function() {

    it("API method : /user/register ", function(done) {
      console.log(' - - - - - - - - - ');

      var dataObject = JSON.stringify({'A':'test', 'U': 'testuser01', 'PW': 'testuser01', 'D': 'test'
      });

      var postheaders = {
        'Content-Type' : 'application/json',
        'Content-Length' : Buffer.byteLength(dataObject, 'utf8')
      };

      // the post options
      var optionspost = {
        host : '127.0.0.1',
        port : 8888,
        path : '/user/register',
        method : 'POST',
        headers : postheaders
      };

      // do the POST call
      var reqPost = http.request(optionspost, function(res) {
        console.log("statusCode: ", res.statusCode);
       
        res.on('data', function(d) {
          console.info('POST result:\n');
          process.stdout.write(d);
          console.info('\n\nPOST completed');
          done();
        });
      });
       
      // write the json data
      reqPost.write(dataObject);
      reqPost.end();
      reqPost.on('error', function(e) {
        console.error(e);
      });
    });
  });
});
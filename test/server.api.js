var xpush  = require('../lib/xpush');
var assert = require('assert');
var fs = require( 'fs' );

// socket.io-client
var io = require( '../node_modules/socket.io/node_modules/socket.io-client' );
var util = require( './util' );

var mongoose = require( '../node_modules/mongoose' );

var NodeConstants  = require('../lib/node-manager/constants');

describe('XPUSH API', function(){

  var X_SESSION_SERVER;
  var X_CHANNEL_SERVERS = [];
  var host = '127.0.0.1';
  var sessionPort = '8000';
  var channelPort = '9000';

  var config =   {
    "zookeeper": {
      "address": "127.0.0.1:2181"
    },
    "redis": {
      "address": "127.0.0.1:6379"
    },
    "mongodb": {
      "address": "127.0.0.1:27017"
    },
    silent : true,
    upload : 'upload'
  };

  var userInfo = {
    'A' : 'testapp01',
    'D' : 'device01',
    'U': 'testuser01',
    'PW': 'pwuser01',
    'C' : 'channel01'
  };

  var userInfo1 = {
    'A' : 'testapp01',
    'D' : 'device02',
    'U': 'testuser02',
    'PW': 'pwuser02',
    'C' : 'channel01'
  };

  before(function(){

    config.home = '.';
    config.host = host;

    var homePath = config.home;
    try {
      if (!fs.existsSync(homePath)) fs.mkdirSync(homePath, 0766);
      if (!fs.existsSync(homePath+'/'+(config.upload || 'upload'))) fs.mkdirSync(homePath+'/'+(config.upload || 'upload'), 0766);
    } catch ( e ){
      console.log( 'Error creating xpush directory: ' + e );
    }

  });

  after(function(){

    // remove session server's node in zookeeper
    X_SESSION_SERVER.nodeManager.removePath(
      NodeConstants.META_PATH + NodeConstants.GW_SERVER_PATH + '/' + host + ':' + sessionPort, process.exit);

    // remove channel server's node in zookeeper
    for( var inx in X_CHANNEL_SERVERS ){
      X_CHANNEL_SERVERS[inx].nodeManager.removeServerNode(X_CHANNEL_SERVERS[inx].options.host, X_CHANNEL_SERVERS[inx].options.port, process.exit); 
    }

    var users = mongoose.model('User');
    var channels = mongoose.model('Channel');
    var unreadmessages = mongoose.model('UnreadMessage');

    users.remove( {'A':'testapp01'}, function(err,result){
      console.log( result );
    });

    channels.remove( {'A':'testapp01'}, function(err,result){
      console.log( result );
    });

    unreadmessages.remove( {'A':'testapp01'}, function(err,result){
      console.log( result );
    });

    try {
      util.deleteFolderRecursive( 'upload' );
    } catch( e ){
      console.log( e );
    }

  });

  describe("#startServer()", function() {
    

    this.timeout(10000);

    it("session server (port:8000)", function(done) {
      config.port = sessionPort;
      X_SESSION_SERVER      = xpush.createSessionServer(config, done);
    });

    it("channel server (port:9000)", function(done) {
      config.port = channelPort;
      X_CHANNEL_SERVERS.push( xpush.createChannelServer(config, done) );
    });

  });

  var token;
  var serverInfo = {};

  describe("#Test User API", function() {

    this.timeout(5000);

    it("API method : /user/register", function(done) {
      var param = userInfo;
      param.DT = { 'NM':'testname01' };
      util.post( host, sessionPort, '/user/register', param, function( err, data ){
        if( data.status == 'ok'){
          done();
        }
      });
    });

    it("API method : /user/register", function(done) {
      var param = userInfo1;
      param.DT = { 'NM':'testname02' };
      util.post( host, sessionPort, '/user/register', param, function( err, data ){
        if( data.status == 'ok'){
          done();
        }
      });
    });

    it("API method : /user/update", function(done) {
      var param = userInfo;
      param.DT = { 'NM':'testname03' };
      util.post( host, sessionPort, '/user/update', param, function( err, data ){
        assert.equal( data.status, 'ok' );
        done();
      });
    });
  });

  describe("#Socket ready", function() {

    it("API method : /auth", function(done) {
      var param = userInfo;
      util.post( host, sessionPort, '/auth', param, function( err, data ){
        token = data.result.token;
        assert.equal( data.status, 'ok' );
        done();
      });
    });

    it("API method : /node", function(done) {
      util.get( host, sessionPort, '/node/' + userInfo.A+'/'+userInfo.C, function( err, data ){
        serverInfo = data.result.server;
        assert.equal( data.status, 'ok' );
        done();
      });
    });
  });

  var sessionSocket;

  describe("#Session socket Test", function() {
    this.timeout(5000);

    it( "Session socket : connect ", function(done) {
      var query = 'A='+userInfo.A+'&'+
          'U='+userInfo.U+'&'+
          'D='+userInfo.D+'&'+
          'TK='+token;

      var socketOptions ={
        transsessionPorts: ['websocket']
        ,'force new connection': true
      };

      sessionSocket = io.connect(serverInfo.url+'/session?'+query, socketOptions);
      sessionSocket.on( 'connect', function (){
        assert(true, 'connected'),
        done();
      });

      sessionSocket.on( 'error', function (){
        assert(false, 'connect error'),
        done();
      });
    });

    it( "Session socket : user-query ", function(done) {
      var param = {query : {'DT.NM':'testname02'}, column: { U: 1, DT: 1, _id: 0 } };

      sessionSocket.emit('user-query', param, function(data){
        assert.equal( 1, data.result.users.length );
        done();
      });
    });

    it( "Session socket : channel-create ", function(done) {
      var param = {'C':userInfo.C, 'U' : [userInfo.U,userInfo1.U], 'DT' : { 'NM' : 'channelName01' } };

      sessionSocket.emit('channel-create', param, function(data){
        assert.equal( data.status, 'ok' );
        done();
      });   
    });

    it( "Session socket : channel-list ", function(done) {
      sessionSocket.emit('channel-list', function(data){
        assert.equal( 1, data.result.length );
        done();
      });    
    });

    it( "Session socket : channel-get ", function(done) {
      var param = {'C':userInfo.C};
      sessionSocket.emit('channel-get', param, function(data){
        assert.equal( param.C, data.result.C );
        done();
      });  
    });

    it( "Session socket : channel-update ", function(done) {
      var param = {'C':userInfo.C, 'Q':{ $set:{ 'DT.NM' : 'channelName02' } } };
      sessionSocket.emit('channel-update', param, function(data){
        assert.equal( data.result.DT.NM, 'channelName02' );
        done();
      });
    });

    it( "Session socket : channel-exit ", function(done) {
      var param = {'C':userInfo.C};
      sessionSocket.emit('channel-exit', param, function(data){
        assert.equal( 1, data.result.US.length );
        done();
      });
    });

    it( "Session socket : group-add ", function(done) {
      var param = {'U':userInfo1.U, 'GR':userInfo.U};
      sessionSocket.emit('group-add', param, function(data){
        assert.equal( data.status, 'ok' );
        done();
      });
    });

    it( "Session socket : group-list ", function(done) {
      var param = {'GR':userInfo.U};
      sessionSocket.emit('group-list', param, function(data){
        assert.equal( userInfo1.U, data.result[0].U );
        done();
      });
    });

    it( "Session socket : group-remove ", function(done) {
      var param = {'U':userInfo1.U, 'GR':userInfo.U};
      sessionSocket.emit('group-remove', param, function(data){
        sessionSocket.emit('group-list', param, function(data){
          assert.equal( 0, data.result.length );
          done();
        });
      });
    });

  });

  describe("#Channel socket Test", function() {
    this.timeout(5000);

    var channelSocket;

    it( "Channel socket : connect ", function(done) {
      var query = 'A='+userInfo.A+'&'+
        'C='+userInfo.C+'&'+
        'U='+userInfo.U+'&'+
        'D='+userInfo.D+'&'+
        'S='+serverInfo.name;

      var socketOptions ={
        transsessionPorts: ['websocket']
        ,'force new connection': true
      };

      channelSocket = io.connect(serverInfo.url+'/channel?'+query, socketOptions);
      channelSocket.on( 'connect', function (){
        assert(true, 'connected'),
        done();
      });

      channelSocket.on( 'error', function (){
        assert(false, 'connect error'),
        done();
      });
    });

    it( "Channel socket : send ", function(done) {
      var param = {'NM':'message', 'DT': { 'MG' : 'Hello world' } };
      channelSocket.on( 'message', function( data ){
        assert.equal( data.MG, param.DT.MG );
        done();
      });

      channelSocket.emit('send', param, function(data){
      });
    });

    it( "Channel socket : message-unread ", function(done) {
      channelSocket.emit( 'message-unread', function( data ){
        assert.equal( data.status, 'ok' );
        done();
      });
    });

    it( "Channel socket : message-received ", function(done) {
      channelSocket.emit( 'message-received', function( data ){
        assert.equal( data.status, 'ok' );
        done();
      });
    });
  });

  describe("#Upload test", function() {

    it("API method : /upload", function(done) {
      var param = { 'appId':userInfo1.A, 'userId':userInfo1.U, 'deviceId':userInfo1.D, 'fileUri': 'test/sample.png', 'channel' :userInfo1.C };
      util.postFile( host, channelPort, '/upload', param, function( err, data ){
        if( data.status == 'ok'){
          done();
        }
      });
    });

  });

});

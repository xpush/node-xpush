var io   = require( '../../node_modules/socket.io/node_modules/socket.io-client' );
var util = require( '../util' );

var port    = process.argv[2];
var app     = process.argv[3];
var channel = process.argv[4];
var userId  = process.argv[5];

console.log('CHANNEL : ', '127.0.0.1:'+port+'/node/' + app + '/' + channel);

util.get( '127.0.0.1', port, '/node/' + app + '/' + channel, function( err, data ){

  console.log(data);

  var query =
    'A='+app+'&'+
    'C='+channel+'&'+
    'U='+userId+'&'+
    'D=DEVAPP&'+
    'S='+data.result.server.name+'&'+
    'DT={AA:"ABCDE"}&'+
    'MD=CHANNEL_ONLY';
    ;

  var socketOptions ={
    transsessionPorts: ['websocket']
    ,'force new connection': true
  };

  console.log('CHANNEL : ',data.result.server.url+'/channel?'+query);

  var channelSocket = io.connect(data.result.server.url+'/channel?'+query, socketOptions);
  channelSocket.on( 'connect', function (){
    console.log('connected');

    channelSocket.emit( 'users', function( data ){
      console.log('************ USERS ************')
      console.log(data);
    });

    var param = {'NM':'message', 'DT': { 'MG' : 'Hello world' } };

    channelSocket.emit('send', param, function(data){
    });

  });

  channelSocket.on( 'message', function( data ){
    console.log(data);
  });

  channelSocket.on( 'error', function (){
    console.log('err');
  });


});

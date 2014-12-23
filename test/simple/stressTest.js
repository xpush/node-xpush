var io    = require( '../../node_modules/socket.io/node_modules/socket.io-client' ),
    util  = require( '../util' ),
    faker = require('faker');

/************************
  로컬의 8000 포트의 Session 서버를 통해서 100개의 Channel 을 연결하고 메시지를 보내기
  USAGE : node stressTest.js 8000 100
*************************/

var port    = process.argv[2];
var count   = process.argv[3] || 1;

var run = function(){


  var app     = "SAMPLE_SERVICE";
  var channel = "CHANNEL_"+faker.random.number(20);
  var userId  = faker.internet.userName();

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

      setInterval(function() {
        channelSocket.emit('send', {'NM':'message', 'DT': { 'MG' : faker.lorem.sentence() } });
      }, 500);

    });

    channelSocket.on( 'message', function( data ){
      console.log(data);
    });

    channelSocket.on( 'error', function (){
      console.log('err');
    });

  });
};


for(var a=0; a<count; a++){
  run();
}

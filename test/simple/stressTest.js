var io    = require( '../../node_modules/socket.io/node_modules/socket.io-client' ),
    util  = require( '../util' ),
    sleep = require('sleep'),
    faker = require('faker');

/************************
  로컬의 8000 포트의 Session 서버를 통해서 100개의 Channel 을 연결하고 메시지를 보내기
  USAGE : node stressTest.js 127.0.0.1:8000 100
*************************/

var address     = process.argv[2];        // session 서버 포트번호
var count       = process.argv[3] || 1;   // Client 쓰레드 수 (Optional)
var maxChannel  = process.argv[4] || 10;  // Client 가 연결하는 Channel 수 (Optional)

var _host = address.substr(0, address.indexOf(':'));
var _port = Number(address.substr(address.indexOf(':') + 1));

var run = function(){


  var app     = "SAMPLE_SERVICE";
  var channel = "CHANNEL_"+faker.random.number(parseInt(maxChannel));
  var userId  = faker.internet.userName();

  console.log('CHANNEL : ', address+'/node/' + app + '/' + channel);

  util.get( _host, _port, '/node/' + app + '/' + channel, function( err, data ){

    var query =
      'A='+app+'&'+
      'C='+channel+'&'+
      'U='+userId+'&'+
      'D=DEVAPP&'+
      'S='+data.result.server.name+'&'+
      'DT={user:"'+userId+'"}&'+
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

      setInterval(function() {
        channelSocket.emit('send', {'NM':'message', 'DT': { 'MG' : faker.lorem.sentence() } });
      }, 1000);

    });

    channelSocket.on( 'message', function( data ){
      //console.log(data);
    });

    channelSocket.on( 'error', function ( data ){
      console.error(data);
    });

  });
};


for(var a=0; a<count; a++){
  run();
  //sleep.sleep(1);
}

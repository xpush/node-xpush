var io    = require( '../../node_modules/socket.io/node_modules/socket.io-client' ),
util  = require( '../util' ),
sleep = require('sleep'),
faker = require('faker');

var address     = process.argv[2];
var ch          = process.argv[3];

var _host = address.substr(0, address.indexOf(':'));
var _port = Number(address.substr(address.indexOf(':') + 1));

var run = function(){

  var app     = "SAMPLE_SERVICE";
  var channel = "CHANNEL_"+ch;
  var userId  = faker.internet.userName();

  console.log('CHANNEL : ', address+'/node/' + app + '/' + channel);

  util.get( _host, _port, '/node/' + app + '/' + channel, function( err, data ){

    var query =
    'A='+app+'&'+
    'C='+channel+'&'+
    'U='+userId.replace(/\./g, '')+'&'+
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

      channelSocket.emit('usersNumber', function (data){
        console.log(data);
      });

    });

    channelSocket.on( 'message', function( data ){
      //console.log(data);
    });

    channelSocket.on( 'error', function ( data ){
      console.error(count_error+" "+data);
      count_error = count_error + 1;
    });

    channelSocket.on('disconnect', function() {
      console.log(count_disconnected + '. disconnected');
      count_disconnected = count_disconnected + 1;
    });

  });
};



run();

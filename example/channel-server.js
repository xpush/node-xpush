var xpush    = require('../lib/xpush'),
  fs       = require('fs'),
  argv     = require('optimist').argv;

var config = {},
    port = argv.port || 80,
    server;

try {
  var data = fs.readFileSync(argv.config);
  config = JSON.parse(data.toString());
} catch (ex) {
  util.puts('Error starting xpush server: ' + ex);
  process.exit(1);
}

config.data = argv.data;
config.silent = typeof argv.silent !== 'undefined' ? argv.silent : config.silent;
config.port = port || config.port;
config.host = argv.host || config.host;

if(argv.weight) config.weight = argv.weight;
if(argv.name)   config.name   = argv.name;

server = xpush.createChannelServer(config);

server.on('started', function (url, port){

  console.log(' >>>>>> CHANNEL SERVER is started '+url+':'+port);
  console.log(server.ping());
  console.log(server.event);
});

server.channel_on('send', function(params, callback){

  console.log('>>>>>>>> THIS IS CUSTOMIZED EVENT !!!!--- ');
  var query = this.handshake.query;

  var DT = query.DT;
  if( DT && typeof DT == 'string' ){
    DT = JSON.parse( DT );
  }

  if( DT.roomLevel == '9'|| DT.roomLevel == 9 ){
    if (callback) callback({ status: 'ERR-AUTH', message: 'Please authorize the user first' });
    return;
  }

  server.send( this,  params, callback );
});

server.channel_on('send2', function(params, callback){

  console.log('>>>>>>>> THIS IS CUSTOMIZED EVENT !!!! ');

});

server.channel_on('connection', function( socket ){
  console.log('>>>>>>>> THIS IS CUSTOMIZED CONNECTION !!!! ');
});

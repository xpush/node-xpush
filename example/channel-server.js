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
  console.error('Error starting xpush server: ' + ex);
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

});

server.channel_on('send', function(params, callback){

  // add your customized pre-processes..

  server.send( this,  params, callback );
});

server.channel_on('send2', function(params, callback){

  server.send( this,  params, callback );

});

server.channel_on('connection', function( socket ){
  console.log('>>>>>>>> THIS IS CUSTOMIZED CONNECTION !!!! ');
});

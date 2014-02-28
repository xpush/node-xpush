
var fs       = require('fs'),
    argv     = require('optimist').argv,
    xpush    = require('../index');

if (!argv.config) {
  return console.error(" --config is not existed !! ");
}

var config = {};

try {
  var data = fs.readFileSync(argv.config);
  config = JSON.parse(data.toString());
} catch (ex) {
  console.log('Error starting xpush server: ' + ex);
  process.exit(1);
}

config.host = 'session.xpush.io';
config.port = 8000;

var server = xpush.createSessionServer(config);

server.static(/\/public\/?.*/, {
  directory: __dirname+'/public'
});

server.once('connected', function (url, port){
  console.log('listen - '+url+':'+port);
});

server.on('oauth', function (data){
  data.response.send('Welcome ' + data.request.user.displayName);
});



server.get('/test', function (req, res, next) {
  res.send({status : 'pong'});
  next();
});

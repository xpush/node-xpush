
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
  util.puts('Error starting xpush server: ' + ex);
  process.exit(1);
}

config.port = 8000;

var server = xpush.createSessionServer(config);

server.on('connected', function (url, port){
  console.log('listen - '+url+':'+port);
});

server.get('/test', function (req, res, next) {
  res.send({status : 'pong'});
  next();
});


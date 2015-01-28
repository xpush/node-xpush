var xpush    = require('../lib/xpush');

var config = {
  "zookeeper": {},
  "redis": {},
  "mongodb": {}
};

config.port = 8888;

var server = xpush.createSessionServer(config);

server.on('connected', function (url, port){

  console.log(' >>>>>> SESSION SERVER is started '+url+':'+port);

});

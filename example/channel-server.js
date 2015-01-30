var xpush    = require('../lib/xpush');

var config = {
  "zookeeper": {},
  "redis": {},
  "mongodb": {}
};

config.port = 9000;
//config.weight = 160;
//config.name   = '';

var server = xpush.createChannelServer(config);

server.on('started', function (url, port){

  console.log(' >>>>>> CHANNEL SERVER is started '+url+':'+port);
  console.log(server.ping());

});

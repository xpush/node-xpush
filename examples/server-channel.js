var xpush = require('../lib/xpush');

var config = {
  "zookeeper": {},
  "redis": {},
  "port": 9001
};

var port = process.argv[2]
if (port) config.port = port;

var server = xpush.createChannelServer(config);


function foo(req, res, next) {
  res.send({hello: 'XPUSH WORLD !!! ' + config.port});
  next();
}

server.on('started', function (url, port) {

  console.log(' >>>>>> Channel SERVER is started ' + url + ':' + port);

});

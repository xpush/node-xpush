var xpush = require('../lib/xpush');

var config = {
  "zookeeper": {},
  "redis": {},
  "mongodb": {}
};

config.port = 8888;

var server = xpush.createSessionServer(config);


function foo(req, res, next) {
  //res.send(204);
  res.send({hello: 'XPUSH WORLD !!! ' + config.port});
  next();
}

server.on('started', function (url, port) {

	server.session_get('/foo', foo);

  console.log(' >>>>>> SESSION SERVER is started ' + url + ':' + port);

});

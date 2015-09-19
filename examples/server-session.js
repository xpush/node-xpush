var xpush = require('../lib/xpush');

var config = {
  "zookeeper": {},
  "redis": {},
  "port": 8888
};

var port = process.argv[2]
if (port) config.port = port;

var server = xpush.createSessionServer(config);


function foo(req, res, next) {
  res.send({hello: 'Hello xpush world.' + config.port});
  next();
}


server.on('started', function (url, port) {

  //You can add request events to xpush session server.
  server.onGet('/foo', foo);

  console.log(' >>>>>> SESSION SERVER is started ' + url + ':' + port);

});

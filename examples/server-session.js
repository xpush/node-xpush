var xpush = require('../lib/xpush');

var config = {
  "zookeeper": {},
  "redis": {},
  "port": 8000
};

var port = process.argv[2]
if (port) config.port = port;

var server = xpush.createSessionServer(config);


function foo(req, res, next) {
  res.send({hello: 'Hello xpush world.' + config.port});
  next();
}

function bar(req, res, next) {
  res.send({hello: 'Hello xpush world.' + config.port});
  next();
}

function foobar(req, res, next) {
  res.send({hello: 'Hello xpush world.' + config.port});
  next();
}


server.on('started', function (url, port) {

  //You can add request events to xpush session server.
  server.onGet('/foo', foo);

  server.onPut('/bar', bar);

  server.onDelete('/foobar', foobar);

  console.log(' >>>>>> SESSION SERVER is started ' + url + ':' + port);

});

var xpush = require('../lib/xpush');

var config = {
  "zookeeper": {},
  "redis": {},
  "mongodb": {}
};

var port = process.argv[2]

config.port = port || 9001;

var server = xpush.createChannelServer(config);


function foo(req, res, next) {
  //res.send(204);
  res.send({hello: 'XPUSH WORLD !!! ' + config.port});
  next();
}

server.put('/foo', foo);
server.get('/foo', foo);
server.del('/foo', foo);
server.post('/foo', foo);


server.on('started', function (url, port) {

  console.log(' >>>>>> Channel SERVER is started ' + url + ':' + port);

});

var xpush = require('../lib/xpush');

var config = {
  "zookeeper": {},
  "redis": {},
  "port": 9001
};

var port = process.argv[2];
if (port) config.port = port;

var server = xpush.createChannelServer(config);

// Customizing connection events
server.onConnection(function (socket) {
  var query = socket.handshake.query;

  console.log('CONNECTION - ' + query.A + " : " + query.C + " : " + query.U);

  // add customized socket events
  socket.on('sessionCount', function (callback) {
    server.getSessionCount(socket, function (err, data) {

      callback({
        status: 'ok',
        result: data
      });

    });
  });

});

server.on('started', function (url, port) {
  console.log(' >>>>>> Channel SERVER is started ' + url + ':' + port);
});

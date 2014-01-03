var events  = require('events'),
    restify = require('restify'),
    sio     = require('socket.io'),
    util    = require('util'),
    NodeManager = require('../node-manager/node-manager.js').NodeManager;

var ApiServer = exports.ApiServer = function (options) {
  if (!options || !options.port) {
    throw new Error('Both `options` and `options.port` are required.');
  }

  if (!options.host) options.host = options.host?options.host: this.getIP();

  var _killProcess = function(){
    self.nodeManager.removeServerNode(options.host, options.port,process.exit);
  }
  process.on('SIGINT',_killProcess).on('SIGTERM',_killProcess); // ctrl+c , kill process(except -9)

  events.EventEmitter.call(this);

  var self  = this;

  this.server = restify.createServer();
  this.io = sio.listen(this.server);
  this.nodeManager = new NodeManager(
    options && options.zookeeper && options.zookeeper.address ? options.zookeeper.address : '',
    false,
    function () {
      self.nodeManager.addServerNode(options.host, options.port);
    }
  );

  this.io.sockets.on('connection', function (socket) {

    socket.on('join', function (appId, channel, fn) {
      socket.channel = channel;
      socket.join(channel);
      
      var members = self.io.sockets.manager.rooms['/'+channel].length;

      fn({id: socket.id, count: members});
    });


    socket.on('send', function (channel, name, data) {
      self.io.sockets.in(channel).emit(name, data)   
    });

    socket.on('disconnect', function () {
      socket.leave(socket.channel);
    });

  });

  this.server.listen(options.port, function () {
    self.emit('connected', self.server.url, options.port);
  });

};

util.inherits(ApiServer, events.EventEmitter);

ApiServer.prototype.send = function (channel, data) {
  
};

ApiServer.prototype.getIP = function () {

  var interfaces = require('os').networkInterfaces();
  for (var devName in interfaces) {
    var iface = interfaces[devName];

    for (var i = 0; i < iface.length; i++) {
      var alias = iface[i];
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal)
        return alias.address;
    }
  }

  return '0.0.0.0';
};


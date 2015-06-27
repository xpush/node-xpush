var io = require('socket.io-client'),
  util = require('./util'),
  faker = require('faker');

var address = process.argv[2];
var count = process.argv[3] || 1;
var channel = process.argv[4] || "zztv01-20150612185253";

var _host = address.substr(0, address.indexOf(':'));
var _port = Number(address.substr(address.indexOf(':') + 1));

var count_connected = 1;
var count_error = 1;
var count_disconnected = 1;

var run = function () {

  var app = "P-00001";
  var userId = faker.internet.userName();

  console.log('CHANNEL : ', address + '/node/' + app + '/' + channel);

  util.get(_host, _port, '/node/' + app + '/' + channel, function (err, data) {

    var uid = userId.replace(/\./g, '');
    uid = "zztv01";
    var DT = {"U": uid, "roomLevel": "0"};
    var query =
      'A=' + app + '&' +
      'C=' + channel + '&' +
      'U=' + uid + '&' +
      'D=DEVAPP&' +
      'S=' + data.result.server.name + '&' +
      'DT=' + JSON.stringify(DT) + '&' +
      'MD=CHANNEL_ONLY';
    ;

    var socketOptions = {transsessionPorts: ['websocket'], 'force new connection': true};
    console.log('CHANNEL : ', data.result.server.url + '/channel?' + query);

    var channelSocket = io.connect(data.result.server.url + '/channel?' + query, socketOptions);

    channelSocket.on('connect', function () {
      console.log(count_connected + '. connected');
      count_connected = count_connected + 1;
      setInterval(function () {
        var DT = {id: "zztv01", message: "dGVzdA%3D%3D"};
        channelSocket.emit('send', {'NM': 'message', 'DT': DT});
      }, 1000);
    });

    channelSocket.on('message', function (data) {
    });

    channelSocket.on('error', function (data) {
      console.error(count_error + " " + data);
      count_error = count_error + 1;
    });

    channelSocket.on('disconnect', function () {
      console.log(count_disconnected + '. disconnected');
      count_disconnected = count_disconnected + 1;
    });

  });

};

for (var a = 0; a < count; a++) {
  run();
}
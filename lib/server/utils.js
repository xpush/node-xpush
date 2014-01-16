exports.getIP = function () {

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

exports.setHttpProtocal = function (_url) {
  if (!/^http:\/\//.test(_url) && !/^https:\/\//.test(_url)){
    return 'http://' + _url;
  }
}

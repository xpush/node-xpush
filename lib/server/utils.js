var restify = require('restify');

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
};

exports.validEmptyParams = function (req, paramArray) {

  for (var i in paramArray){
    if(!req.params[paramArray[i]]) {
      return new restify.InvalidArgumentError('['+paramArray[i]+'] must be supplied'); 
    }
  }

  return false;
};

exports.validSocketParams = function (params, paramArray) {

  for (var i in paramArray){
    if(!params[paramArray[i]]) {
      return {status: 'error', message: '['+paramArray[i]+'] must be supplied'}; 
    }
  }

  return false;
};

exports.regExpEscape = function(s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
};

var restify = require('restify'),
    crypto  = require("crypto");

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

exports.encrypto = function(s, t) {
  if(!t) t = "sha256";
  var _c = crypto.createHash(t);
  _c.update(s, "utf8");//utf8 here
  return _c.digest("base64");
};

var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz';

exports.randomString = function(length) {
  length = length ? length : 32;

  var string = '';

  for (var i = 0; i < length; i++) {
    var randomNumber = Math.floor(Math.random() * chars.length);
    string += chars.substring(randomNumber, randomNumber + 1);
  }

  return string;
}

exports.parseCookies = function(request) {
    var list = {},
        rc = request.headers.cookie;

    rc && rc.split(';').forEach(function( cookie ) {
        var parts = cookie.split('=');
        list[parts.shift().trim()] = unescape(parts.join('='));
    });

    return list;
}

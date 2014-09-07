var winston = require('winston');
var fs = require('fs');

module.exports = function(conf) {
  var port = conf.port;
  var xpushDataPath = conf.path;

  if (!fs.existsSync(xpushDataPath + '/log')) fs.mkdirSync(xpushDataPath + '/log', 0766);

  winston.loggers.add('error', {
    file: {
      filename: xpushDataPath + '/log/error_' + port + '.log'
    }
  });
  winston.loggers.add('log', {
    file: {
      filename: xpushDataPath + '/log/log_' + port + '.log'
    }
  });

  var transports = [
  new(winston.transports.Console)({
    colorize: true,
    prettyPrint: true,
    timestamp: true
    //, level : 'debug'
  }),
  new(winston.transports.File)({
    filename: xpushDataPath + '/log/log_' + port + '.log'
  })];

  var log = new(winston.Logger)({
    'transports': transports
  });

  function newTC(n) {
    if (isNaN(n) || n < 0) n = 1;
    n += 1;
    var s = (new Error()).stack.split('\n');

    var a = s[n];
    var s = 0;
    if (a.indexOf('\\') > 0) {
      s = a.lastIndexOf('\\');
    }
    else if (a.indexOf('/') > 0) {
      s = a.lastIndexOf('/');
    }
    a = a.substr(s + 1);
    a = a.substr(0, a.lastIndexOf(':'));
    return a;
  }

  function traceCaller(n) {
    if (isNaN(n) || n < 0) n = 1;
    n += 1;
    var s = (new Error()).stack,
      a = s.indexOf('n', 5);
    while (n--) {
      a = s.indexOf('n', a + 1);
      if (a < 0) {
        a = s.lastIndexOf('n', s.length);
        break;
      }
    }
    b = s.indexOf('n', a + 1);
    if (b < 0) b = s.length;
    a = Math.max(s.lastIndexOf(' ', b), s.lastIndexOf('/', b));
    b = s.lastIndexOf(':', b);
    s = s.substring(a + 1, b);
    return s;
  }

  for (var k in winston.levels) {
    (function(key) {
      var oldFunc = log[key];
      log[key] = function() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(newTC(2));
        oldFunc.apply(log, args);
      }
    })(k);
  }

  //console.log = winston.loggers.get('log').info;
  console.log = log.info;
  //console.info = winston.loggers.get('log').info;
  console.info = log.info;
  console.error = log.error;
  //console.error = winston.loggers.get('error').error;

};
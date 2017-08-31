var path = require('path');
var fs = require('fs');
var spawn = require('child_process').spawn;
var utils = require('../util/utils');

exports.startDaemon = function (options, callback) {

  var monitorFilePath = path.resolve(__dirname) + '/daemon-process';

  var pidFilePath = utils.getPidFilePath(options['home'], 'CHANNEL', options['port']);
  var basePath = utils.getBaseDirPath(options['home']);
  var logFilePath = utils.getDaemonLogFilePath(options['home'], 'CHANNEL', options['port']);

  if (fs.existsSync(pidFilePath)) {

    if (callback) callback({
      code: 'PID_EXISTED',
      message: ' Check the status of server is running. \n - process id file was already existed : ' + pidFilePath + '\n - log file : ' + logFilePath + '\n'
    });

  } else {

    console.log('  [ monitoring daemon ]');
    console.log('  -- log : ' + logFilePath);

    var
      out = fs.openSync(logFilePath, 'a'),
      err = fs.openSync(logFilePath, 'a');

    var paramEnv = {
      X_TYPE: 'CHANNEL',
      X_PID: process.pid,
      X_PATH: basePath,
      X_HOST: options['host'],
      X_PORT: options['port'],
      X_SERVER_NAME : options['serverName'],
      X_ZOOKEEPER: options['zookeeper']
    };

    spawn(process.execPath, [monitorFilePath], {
      stdio: ['ignore', out, err],
      detached: true,
      env: paramEnv
    }).unref();

    if (callback) callback(null);

  }

};

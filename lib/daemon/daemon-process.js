var fs = require('fs');
var path = require('path');
var xpush = require('xpush');
var async = require('async');
var utils = require('../utils');

var envType = process.env.X_TYPE; // SESSION, CHANNEL
var envPid = process.env.X_PID;   // Process Id
var envPath = process.env.X_PATH; // home dir path
var envHost = process.env.X_HOST;
var envPort = process.env.X_PORT;
var envZookeeper = process.env.X_ZOOKEEPER;
var envServerName = process.env.X_SERVER_NAME;

var serverName;

var pidFilePath = utils.getPidFilePath(envPath, envType, envPort);

console.log('\n [ Daemon Process got started. ]');

console.log(' - TYPE : ' + envType);
console.log(' - PID : ' + envPid + ' (' + pidFilePath + ')');
console.log(' - PATH : ' + envPath);
console.log(' - HOST : ' + envHost);
console.log(' - PORT : ' + envPort);
console.log(' - SERVER_NAME : ' + envServerName);

function exit() {
  console.warn('What the hell ... ? By the way, bye ... :) ');
  process.exit(0);
}

process.on('SIGINT', exit);
process.on('SIGTERM', exit);

var afterProcess = function () {

  var zkClient;
  var redisClient;

  async.series([

    function (callback) {

      zkClient = xpush.createZookeeperClient(envZookeeper);
      zkClient.once('connected', function () {

        zkClient.getChildren(
          '/xpush/servers',
          function (error, nodes, stats) {
            if (error) {
              console.error(error.stack);
              callback(error);
              return;
            }

            var server = envHost + ':' + envPort;
            var isExisted = false;

            for (var i = 0; i < nodes.length; i++) {

              var ninfo = nodes[i].split('^'); // 0: name, 1:ip&Port, 2: replicas

              var isEqual = false;
              if( server == ninfo[1] ){
                isEqual = true;

                if( envServerName && envServerName != ninfo[0] ){
                  isEqual = false;
                }
              }

              if (isEqual) { // address (1)

                isExisted = true;

                // 1. ServerName
                if( !serverName ){
                  serverName = ninfo[0];
                }

                // 2. Remove ZNode
                zkClient.remove(
                  '/xpush/servers/' + nodes[i],
                  -1,
                  function (err) {
                    if (err) {
                      console.log('Failed to remove node due to: %s.', err);
                      callback(err);
                    } else {
                      callback(null);
                    }
                  }
                );

                break;
              }

            }

            if (!isExisted) { // 존재하지 않으면 다음을 진행 할 수 없음
              callback('Zookeeper node was not existed.');
            }

          }
        );

      });

      zkClient.connect();
    },
    function (callback) {
      console.info('"ServerName" on terminating : [' + serverName + ']');
      callback(null);
    }
  ], function (err, results) {

    if (err) {
      console.error(err, results);
    }

    process.nextTick(function () {

      zkClient.close();

      console.log('Bye ... :) ');

      process.exit(0);

    });

  });


};

var checkProcess = function () {

  var isRunning = utils.checkProcess(envPid);

  if (isRunning) {
    process.stdout.write('.');
    setTimeout(checkProcess, 700);

  } else {
    process.stdout.write('\n');
    afterProcess();
  }

};

var pid = require('./../pid').create(pidFilePath);
pid.removeOnExit();

console.log('\n' + new Date());
checkProcess();

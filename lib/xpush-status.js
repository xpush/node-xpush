var http       = require('http'),
    colors   = require('colors'),
    zookeeper  = require('node-zookeeper-client'),
    constants  = require('./node-manager/constants');


exports.sessionServer = function (addr, done) {

  process.stdout.write('\n ### Session Servers \n');

  var address = addr || 'localhost:2181';

  var zkClient = zookeeper.createClient(address);

  zkClient.connect();

  zkClient.getChildren(
    constants.BASE_ZNODE_PATH + constants.META_PATH + constants.GW_SERVER_PATH,
    function (error, nodes, stats) {

      if (error) {
        console.log(error.stack);
        return;
      }

      var servers = [];

      for (var i = 0; i < nodes.length; i++ ){

        var _host = nodes[i].substr(0, nodes[i].indexOf(':'));
        var _port = Number(nodes[i].substr(nodes[i].indexOf(':')+1));

        servers.push({
          host: _host,
          port: _port
        });

      }

      var totalCnt = servers.length;
      var checkUrls = function () {
        var server = servers.shift();

        process.stdout.write('   ['+(totalCnt-servers.length)+'/'+totalCnt+'] '+server.host+':'+server.port+' - ');

        http.get({ host: server.host, port: server.port, path: '/status/ping' }, function(res) {
          var body = '';
          res.on('data', function (d) { body += d; });
          res.on('end', function () {

            bodyObj = JSON.parse(body);

            process.stdout.write(' '+bodyObj.status.bold.green+' \n');
            if( servers.length ) {
              checkUrls();
            }else {
              if(done) done();
            }
          });
        }).on('error', function(e) {
          process.stdout.write(' '+e.message.bold.red+' \n');
          if( servers.length ) {
            checkUrls();
          }else {
            if(done) done();
          }
        });
      };

      if(totalCnt > 0) {
        checkUrls();
      }else{
        process.stdout.write(' is not existed.'.red+' \n');
        if(done) done();
      }

      zkClient.close();
    }
  );

};


exports.channelServer = function (addr, done) {

  process.stdout.write('\n ### Channel Servers \n');

  var address = addr || 'localhost:2181';

  var zkClient = zookeeper.createClient(address);

  zkClient.connect();

  zkClient.getChildren(
    constants.BASE_ZNODE_PATH + constants.SERVERS_PATH,
    function (error, nodes, stats) {

      if (error) {
        console.log(error.stack);
        return;
      }

      var servers = [];

      for (var i = 0; i < nodes.length; i++ ){

        var addrAndPort = nodes[i].substr(nodes[i].indexOf('^')+1);
        var _host = addrAndPort.substr(0, addrAndPort.indexOf(':'));
        var _port = Number(addrAndPort.substr(addrAndPort.indexOf(':')+1));
        var _snum = Number(nodes[i].substr(0, nodes[i].indexOf('^')));

        servers.push({
          snum: _snum,
          host: _host,
          port: _port
        });

      }

      var totalCnt = servers.length;
      var checkUrls = function () {
        var server = servers.shift();

        process.stdout.write('   ['+(totalCnt-servers.length)+'/'+totalCnt+'] ('+server.snum+') '+server.host+':'+server.port+' - ');

        http.get({ host: server.host, port: server.port, path: '/status/ping' }, function(res) {
          var body = '';
          res.on('data', function (d) { body += d; });
          res.on('end', function () {

            bodyObj = JSON.parse(body);

            if(bodyObj && bodyObj.status){
              process.stdout.write(' '+bodyObj.status.bold.green+' \n');
            }else{
              var _msg = 'Not Existed';
              process.stdout.write(' '+_msg.bold.red+' \n');
            }
            if( servers.length ) {
              checkUrls();
            }else {
              if(done) done();
            }
          });
        }).on('error', function(e) {
          process.stdout.write(' '+e.message.bold.red+' \n');
          if( servers.length ) {
            checkUrls();
          }else {
            if(done) done();
          }
        });
      };


      if(totalCnt > 0) {
        checkUrls();
      }else{
        process.stdout.write(' is not existed.'.red+' \n');
        if(done) done();
      }


      zkClient.close();
    }
  );

};

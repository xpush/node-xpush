var zookeeper = require('node-zookeeper-client'),
    influx    = require('influx'),
    io        = require('../node_modules/socket.io/node_modules/socket.io-client'),
    constants = require('./node-manager/constants');

var harvester = function(){

  this.servers = [];
  this.ios = {};
  this.infos = {};
  this.summary = {};

};

harvester.prototype.start = function(config){
  
  this.dbInflux = influx({
    host :     config.influxdb.host,
    port :     config.influxdb.port,
    username : config.influxdb.username,
    password : config.influxdb.password,
    database : config.influxdb.database
  });

  var address = config.zookeeper.address || 'localhost:2181';

  this.zkClient = zookeeper.createClient(address);
  this.zkClient.connect();

  this.watchingNodes(config);
  this.collect(config);

};

harvester.prototype.watchingNodes = function(config){

  var self = this;

  this.zkClient.getChildren(constants.BASE_ZNODE_PATH + constants.SERVERS_PATH, function (event) {
    self.watchingNodes(config);
  }, function(error, nodes, stats) { // > watching callback START

    if (error) {
      console.error('Error watching zookeeper nodes: ', error);
      process.exit(1);
    }

    self.servers = [];
    for (var i = 0; i < nodes.length; i++) {

      var ninfo = nodes[i].split('^');

      if ( !self.ios[ninfo[1]] ) {

        var query = '1=1';
        if(config.token) query = 'token='+config.token;

        self.ios[ninfo[1]] = io.connect(
          'http://'+ninfo[1]+'/admin?'+query,
        { transsessionPorts: ['websocket'] ,'force new connection': true }
      );

      console.log('>>>>', 'http://'+ninfo[1]+'/admin?'+query);

      self.ios[ninfo[1]].on( 'connect', function (){
        console.log('connected.');

        /*self.ios[ninfo[1]].emit('usage', function(data){
        self.infos[ninfo[1]] = data;
      });*/

    });

    self.ios[ninfo[1]].on( 'error', function (err){
      console.error('err : ', err);
    });
  }

  self.servers.push({
    id  : ninfo[0],
    /*host: ninfo[1].substr(0, ninfo[1].indexOf(':')),
    port: Number(ninfo[1].substr(ninfo[1].indexOf(':') + 1)),*/
    url : ninfo[1],
    repl: ninfo[2]
  });

}

}); // < watching callback END

};

harvester.prototype.collect = function(config){

  var self = this;

  var interval = 2000 || config.interval;

  setInterval(function() {

    var _temp = new Date().getTime();
    for (var key in self.summary) {
      // if (self.summary.hasOwnProperty(key))
      if(_temp - Number(self.summary[key].t) > 5000 ) {
        delete self.summary[key];
      }
    }

    var arrayLength = self.servers.length;

    for (var i = 0; i < arrayLength; i++) {

      if(self.ios[self.servers[i].url]){

        console.log(' ------- '+self.servers[i].url);

        self.ios[self.servers[i].url].emit('usage', function(data){
          
          self.summary[data.name] = {
            t: new Date().getTime(),
            s: Number(data.client.socket),  // socket
            c: Number(data.client.channel)  // channel
          };

          var tname = 'xpush.channel.'+ data.name ;
          console.log(' >>> ',tname, data);

          self.dbInflux.writePoint(tname , {
            time:              new Date(),  // reserved key for influxDB
            host:              data.host,            
            server:            data.name,
            uptime:            data.uptime,
            memory_rss:        data.memory.rss,        // Resident set size
            memory_total:      data.memory.heapTotal,  // Heap size sampled immediately after a full garbage collection
            memory_used:       data.memory.heapUsed,   // Current heap size
            memory_usage:      data.memory.heapUsed/data.memory.rss*100,   // Current memory rate per RSS
            client_socket:     data.client.socket,
            client_channel:    data.client.channel,
            client_bigchannel: data.client.bigchannel
          }, function(err) {
            if(err) throw err;
          });

        });
      }

    }

  }, interval);

  setInterval(function() {

    var _data = {
      time:    new Date(),
      socket:  0,
      channel: 0
    };

    for (var key in self.summary) {
      _data.socket  = _data.socket  + self.summary[key].s;
      _data.channel = _data.channel + self.summary[key].c;
    }
    console.log(_data);
    self.dbInflux.writePoint('xpush.summary' , _data, function(err) {
      if(err) throw err;
    });

  }, interval);
};

module.exports = new harvester();

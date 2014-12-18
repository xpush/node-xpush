var async    = require('async'),
    SessionManager = require('../../lib/session-manager/session-manager.js').SessionManager
    ;

var redisClient;
var app = 'SAMPLE',
    channel = 'CH02';

var nodeMap = {
  '01' : '01^127.0.0.1:1111',
  '11' : '01^127.0.0.1:1111',
  '21' : '01^127.0.0.1:1111',
  '31' : '01^127.0.0.1:1111',
  '41' : '01^127.0.0.1:1111',
  '51' : '01^127.0.0.1:1111',
  '61' : '01^127.0.0.1:1111'
};

try {

  async.parallel([
    function(callback) {
      sessionManager = new SessionManager('', callback);
    },
    function(callback) { sessionManager.update(app, channel, '01', 41, callback); },
    function(callback) { sessionManager.update(app, channel, '11', 5, callback); },
    function(callback) { sessionManager.update(app, channel, '21', 6, callback); },
    function(callback) { sessionManager.update(app, channel, '31', 5, callback); },
    function(callback) { sessionManager.update(app, channel, '41', 7, callback); },
    function(callback) { sessionManager.update(app, channel, '51', 8, callback); },
    function(callback) { sessionManager.update(app, channel, '61', 6, callback); },
    function(callback) { sessionManager.update(app, 'ONLY_ONE', '11', 5, callback); },
    function(callback) {
      sessionManager.retrieve(app, 'ONLY_ONE', function(res) {

        var server  = "";

        if(res){ // already existed in redis.

          console.log('. from redis : ', res);


          var mServer = "";
          var count   = -1;

          for(var key in res){

            console.log(key, res[key]);

            if( res[key] < 3 ){ // MAX_CONNECTION

              server = key;
              count  = parseInt(res[key]);
              break;

            }else{

              if(count > -1){
                if (res[key] < count){
                  count = parseInt(res[key]);
                  mServer = key;
                }
              }else{
                count = parseInt(res[key]);
                mServer = key;
              }

            }
          }

          console.log(".1.0 서버 할당 되었는지?  server : ",  server);
          console.log(".1.1 서버 할당 되었는지? mServer : ", mServer);

          if(!server){
            for(var name in nodeMap){
              if( !res[name] ){
                server = name;
                break;
              }
            }
          }

          console.log(".2 server : ",  server);

          if(!server) server = mServer;

          console.log(".3 server : ",  server);


          console.log(server);

        }else{
          console.log('NOT');
        }


        console.log('RESULT : ',server, count);
        callback;
      });
    }

  ],

  // And then, STARTUP !!
  function(err, results) {
    console.log(results);
  });

} catch (err) {
  console.log(err);
}

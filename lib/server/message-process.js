var redis          = require('redis'),
    mongoPersister = require('../mongodb-persister/mongoPersister'),  
    database       = require('../mongodb-persister/database');

database.config(process.argv[2],process.argv[3], function (_err, _message) {

  process.send({
    err : _err,
    message: _message
  });

});

var redisPublisher;
var redisAddr = process.argv[4];
if(redisAddr){
  redisPublisher = redis.createClient(redisAddr.split(':')[1], redisAddr.split(':')[0]);
}else{
  redisPublisher = redis.createClient();
}


//process.on('message', function(command, argObj) {
process.on('message', function(arg) {

	
	/*
      action: 'notification',
      app: _app,
      channel: _channel,
      name: _name,
      data: _data,
      sessionIds : tempSessionIds
	*/
	
  if(arg.action == 'notification'){

    console.log(' ---- MESSAGE-PROCESS(forked) ----- ');

    mongoPersister.getUsersForNotification(arg.app, arg.channel, function (err, users, msg) {

      if(err) {
        process.send(err);
				return;
      }

      if(users == null || typeof users == 'undefined' ) return;
			
			for(var i=0; i<users.length; i++){
				
				var user = users[i];
				
				if(!user.sessionId) {
				
					if( user.deviceType == 'web' ){
						
						var _transferObj = {
							socketId: user.notiId.split('^')[1],
							app: arg.app,
							channel: arg.channel,
							name: 'notification', 
							data: arg.data
						};
						
						redisPublisher.publish('C-'+user.notiId.split('^')[0], JSON.stringify(_transferObj));
						
					}else{	
						
						// TODO - for the other device types.
						// session socket 연결이 있으면 socket 으로 메시지를 보내고, 아니면, Notification !!
						// 그런데.. 어떻게 사용자가  session socket 연결 상태인지 알 수 있을까? (mongodb 접속하지 않고...)
						
					}
					
					mongoPersister.createMessage(
						arg.app, 
						arg.channel, 
						{}, // TODO  sender 는 꼭 넣어야 할까요? data 에 필요한 정보는 저장하면 되는데..
						{userId: user.userId, deviceType: user.deviceType},
						arg.data, 
						
						function (err) {
							if(err) {
								console.log(err);
							}
						}
					);
					
				}
				
			}



      
    });

  }

});


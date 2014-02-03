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
				
				//	if( user.deviceType == 'web' ){
					if( user.notiId ){
						
						var _transferObj = {
              				notiId: user.notiId,
							app: arg.app,
							channel: arg.channel,
							name: 'notification', 
							data: arg.data
						};
						
						redisPublisher.publish('C-'+user.notiId.split('^')[0], JSON.stringify(_transferObj));

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


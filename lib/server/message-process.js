var mongoPersister = require('../mongodb-persister/mongoPersister'),  
    database       = require('../mongodb-persister/database');

database.config(process.argv[2],process.argv[3], function (_err, _message) {

  process.send({
    err : _err,
    message: _message
  });

});

//process.on('message', function(command, argObj) {
process.on('message', function(arg) {

  if(arg.action == 'notification'){

    console.log(' ---- MESSAGE-PROCESS(forked) ----- ');

    mongoPersister.getChannel(arg.app, arg.channel, function (err, channel, msg) {

      if(err) {

        console.log(err);

        process.send(err);
      }

      if(channel){

        if(arg.sessionIds.length == channel.users.length){
          return; 
        }
        
        for(var i=0; i<channel.users.length; i++){
         
        // TODO GCM 이나 APN 으로 메시지 보내기 !!! 
        // args.sessionIds 에는socket 연결되어 있어서 이미 메시지가 전송된 sessionId 들이 있고,
        // channel.users 에는 이 channel 에 있는 사용자이며 각각 sessionId를 가지고 있.
        // 보낸 사용자인지? 아니면 socket에 없어서 못보낸건지 체크하고 아래 로직과 notification 하도록 해야 함.

          mongoPersister.createMessage(
            channel.app, 
            channel.channel, 
            {}, // TODO  sender 는 꼭 넣어야 할까요?
            channel.users[i],
            arg.data, 

            function (err) {
              if(err) {
                console.log(err);
              }
            }
          );

        }



      }else{
        console.log('Message : '+msg);
      }

      
    });

  }

});


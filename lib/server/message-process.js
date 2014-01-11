var mongoPersister = require('../mongodb-persister/mongoPersister');  

process.on('message', function(_app, _channel, _name, _data, _sockets) {

  console.log('     message-process.js');
  console.log(_sockets);

  mongoPersister.getUsersChannel(_app, _channel, function (err, channel, msg) {

    if(err) {
      // TODO 에러 처리 어떻게 해야 하나요? 만약 에러 난다면, 
      console.log(err);
      process.send(err);
    }

    if(channel){
      
    }


  });

});

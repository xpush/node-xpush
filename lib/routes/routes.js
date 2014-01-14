var userAPI    = require('./user'),
    channelAPI = require('./channel');

exports = module.exports = function(server, nodeManager){

  server.get ('/ping', function (req, res, next) { res.send({status : 'pong'}); });


  /** /app/~ **/
  //server.post('/app/:app'    , appAPI.create);

  /** /user/~ **/
  server.get ('/user/:app/:userId', userAPI.getUser     ); 
  server.post('/user/register'    , userAPI.registerUser);
  server.post('/user/login'       , userAPI.login       );
  server.post('/user/logout'      , userAPI.logout      );

  /** /channel/~ **/
  server.post('/channel/create/:channel', channelAPI.create    );
  server.post('/channel/join/:channel'  , channelAPI.join      );
  server.get ('/channel/:app/:userId'   , channelAPI.getChannel);
  
  if(nodeManager) {
    
    var appAPIClass = require('./app').appAPI;
    var appAPI = new appAPIClass(nodeManager);

    server.post('/app/create/:appNm', appAPI.create   );
    server.get ('/app/:appId',        appAPI.retrieve );
    server.post('/app/remove/:appId', appAPI.remove   );
    server.get ('/app/list',          appAPI.list     );
  }

};

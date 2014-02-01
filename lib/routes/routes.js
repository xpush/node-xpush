var appAPI     = require('./app'),
    userAPI    = require('./user');

exports = module.exports = function(server, nodeManager){

  server.get ('/ping', function (req, res, next) { res.send({status : 'pong'}); });

  // *** [User API](./user.html) 
  server.post('/user/register'    , userAPI.register    );

  // *** [Channel API](./channel.html) 
  /*
  server.post('/channel/create/:channel', channelAPI.create);
  server.post('/channel/join/:channel'  , channelAPI.join  );
  server.get ('/channel/list'   , channelAPI.list  );
  */
  if(nodeManager) {
    
    var appAPIClass = require('./app').appAPI;
    var appAPI      = new appAPIClass(nodeManager);

    // *** [application API](./app.html) 
    server.put('/app/:appNm', function (req, res) {
      appAPI.create(req, res);
    });
    server.del('/app/:appId', function (req, res) {
      appAPI.remove(req, res);
    });
    server.get('/app/:appIdOrNm', function (req, res) { 
      appAPI.retrieve(req, res);
    });
    server.get ('/app', function (req, res) { 
      appAPI.list(req, res);
    });

  }

  console.info('  - API resouces is applied (routed)'); 

};

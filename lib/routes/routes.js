var appAPI     = require('./app'),
    userAPI    = require('./user'),
    serverUtils= require('../server/utils'),
    _          = require('underscore');

exports = module.exports = function(conf, server, nodeManager){

  server.get ('/ping', function (req, res, next) { res.send({status : 'pong'}); });

  server.post('/user/register'    , userAPI.register    );

  server.post('/user/update'      , userAPI.update      );

  // for APP Resources 

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

  if(conf.oauth) {
    require('./oauth/oauth')(conf, server);
  }

};



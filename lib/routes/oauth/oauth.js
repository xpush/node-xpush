var passport    = require('passport'),
    serverUtils = require('../../server/utils');

exports = module.exports = function(conf, server){

  if(conf.oauth) {

    server.use(passport.initialize());
    var serverUrl = serverUtils.setHttpProtocal( conf.host+( (conf.port == 80) ? '' : ':'+conf.port))

    if(conf.oauth.facebook){

      require('./oauth-facebook').install(server, passport, {
        key         : conf.oauth.facebook.key,
        secret      : conf.oauth.facebook.secret,
        serverUrl   : serverUrl,
        authUrl     : conf.oauth.facebook.authUrl,
        callbackUrl : conf.oauth.facebook.callbackUrl,
        event       : conf.oauth.facebook.event,
        success     : conf.oauth.facebook.success
      });

    }else if(conf.oauth.twitter){

    }else if(conf.oauth.google){

    }

  }

}

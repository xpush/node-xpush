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

    }

    if(conf.oauth.twitter){

      require('./oauth-twitter').install(server, passport, {
        consumerKey         : conf.oauth.twitter.key,
        consumerSecret      : conf.oauth.twitter.secret,
        serverUrl   : serverUrl,
        authUrl     : conf.oauth.twitter.authUrl,
        callbackUrl : conf.oauth.twitter.callbackUrl,
        event       : conf.oauth.twitter.event,
        success     : conf.oauth.twitter.success
      });

    }

    if(conf.oauth.googleplus){

      require('./oauth-googleplus').install(server, passport, {
        clientId    : conf.oauth.googleplus.key,
        clientSecret: conf.oauth.googleplus.secret,
        serverUrl   : serverUrl,
        authUrl     : conf.oauth.googleplus.authUrl,
        callbackUrl : conf.oauth.googleplus.callbackUrl,
        event       : conf.oauth.googleplus.event,
        success     : conf.oauth.googleplus.success
      });

    }

  }

}

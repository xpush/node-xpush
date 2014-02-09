var appAPI     = require('./app'),
    userAPI    = require('./user'),
    _          = require('underscore');

exports = module.exports = function(conf, server, nodeManager){

  server.get ('/ping', function (req, res, next) { res.send({status : 'pong'}); });

  server.post('/user/register'    , userAPI.register    );

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

  console.error(conf.oauth.facebook.callback ? conf.oauth.facebook.callback : (conf.host+(conf.post == 80) ? '' : ':'+conf.port));

  if(conf.oauth) {

    var passport = require('passport');

    if(conf.oauth.facebook){

      if(_.isEmpty(conf.oauth.facebook.key) || _.isEmpty(conf.oauth.facebook.secret)){
        var errMessage = '';
        if(_.isEmpty(conf.oauth.facebook.key)) errMessage = errMessage + '["key": Facebook App ID] ';
        if(_.isEmpty(conf.oauth.facebook.secret)) errMessage = errMessage + '["secret": Facebook App Secret] ';
        errMessage = errMessage + 'is not filled on the config file for XPUSH Session Server.\n refer to your facebook developer site(https://developers.facebook.com).';
        console.error(errMessage);

      }else{

        FacebookStrategy = require('passport-facebook').Strategy;
        passport.use(new FacebookStrategy({
            clientID:     conf.oauth.facebook.key,
            clientSecret: conf.oauth.facebook.secret,
            callbackURL:  conf.oauth.facebook.callback ? conf.oauth.facebook.callback : (conf.host+(conf.post == 80) ? '' : ':'+conf.port)
          },
          function(accessToken, refreshToken, profile, done) {
            /*User.findOrCreate(..., function(err, user) {
              if (err) { return done(err); }
              done(null, user);
            });*/
          }
        ));

      }

    }
  }

};



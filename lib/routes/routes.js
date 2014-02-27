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

    var passport = require('passport');
    
    // initialize passport
    server.use(passport.initialize());

    if(conf.oauth.facebook){

      if(_.isEmpty(conf.oauth.facebook.key) || _.isEmpty(conf.oauth.facebook.secret)){
        var errMessage = '';
        if(_.isEmpty(conf.oauth.facebook.key)) errMessage = errMessage + '["key": Facebook App ID] ';
        if(_.isEmpty(conf.oauth.facebook.secret)) errMessage = errMessage + '["secret": Facebook App Secret] ';
        errMessage = errMessage + 'is not filled on the config file for XPUSH Session Server.\n refer to your facebook developer site(https://developers.facebook.com).';
        console.error(errMessage);

      }else{

        conf.oauth.facebook.callback = conf.oauth.facebook.callback ? conf.oauth.facebook.callback : (conf.host+( (conf.post == 80) ? '' : ':'+conf.port) );
        conf.oauth.facebook.callback = serverUtils.setHttpProtocal( conf.oauth.facebook.callback + '/auth/facebook/callback' );
        
        FacebookStrategy = require('passport-facebook').Strategy;
        passport.use(new FacebookStrategy({
            clientID:     conf.oauth.facebook.key,
            clientSecret: conf.oauth.facebook.secret,
            callbackURL:  conf.oauth.facebook.callback
          },
          function(accessToken, refreshToken, profile, done) {
            /*console.log('##############');
            console.log('accessToken  : ', accessToken);
            console.log('refreshToken : ', refreshToken);
            console.log('profile      : ', profile);
            console.log('##############'); */
            done(null, profile);
            /*User.findOrCreate(..., function(err, user) {
              if (err) { return done(err); }
              done(null, user);
            });*/
          }
        ));

        server.get('/auth/facebook', 
          passport.authenticate('facebook', { session: false }));

        server.get('/auth/facebook/callback', 
          passport.authenticate('facebook', { session: false }),
          function(req, res) {

            var _r = server._fireEvent(
              'oauth', 
              {provider: 'facebook', request: req, response: res}
            );

            if( !_r ){
              res.send(req.user); // res.redirect('/A.html');
            }

          });

      }

    }
  }

};



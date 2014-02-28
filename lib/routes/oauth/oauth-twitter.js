var _          = require('underscore');

exports.install = function (server, passport, conf){

  if(_.isEmpty(conf.consumerKey) || _.isEmpty(conf.consumerSecret)){
    var errMessage = '';
    if(_.isEmpty(conf.consumerKey)) errMessage = errMessage + '["consumerKey": Twitter App ID] ';
    if(_.isEmpty(conf.consumerSecret)) errMessage = errMessage + '["consumerSecret": Facebook App Secret] ';
    errMessage = errMessage + 'is not filled on the config file for XPUSH Session Server.\n refer to your facebook developer site(https://developers.facebook.com).';
    console.error(errMessage);

  }else{

    var authUrl = conf.authUrl;
    if(_.isEmpty(conf.authUrl)) authUrl = '/auth/twitter';

    var callbackUrl = conf.callbackUrl;
    if(_.isEmpty(conf.callbackUrl)) callbackUrl = '/auth/twitter/callback';
    
    FacebookStrategy = require('passport-twitter').Strategy;

    passport.use(new TwitterStrategy({
        consumerKey:    conf.consumerKey,
        consumerSecret: conf.consumerSecret,
        callbackURL:    conf.serverUrl + callbackUrl 
      },
      function(token, tokenSecret, profile, done) {
        return done(err, profile);
      }
    ));

    server.get(authUrl, 
      passport.authenticate('twitter', { session: false }));

    server.get(callbackUrl, 
      passport.authenticate('twitter', { session: false }),
      function(req, res) {

        var _r = server._fireEvent(
          'oauth', 
          {provider: 'twitter', request: req, response: res}
        );

        if( !_r ){
          res.send(req.user); // res.redirect('/'); ?
        }

      });

    console.log('Twitter oauth >');
    console.log('        - url :  '+ conf.serverUrl + authUrl );
    console.log('   - callback :  '+ conf.serverUrl + callbackUrl );

  }

};



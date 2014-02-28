var _          = require('underscore');

exports.install = function (server, passport, conf){

  if(_.isEmpty(conf.key) || _.isEmpty(conf.secret)){
    var errMessage = '';
    if(_.isEmpty(conf.key)) errMessage = errMessage + '["key": Facebook App ID] ';
    if(_.isEmpty(conf.secret)) errMessage = errMessage + '["secret": Facebook App Secret] ';
    errMessage = errMessage + 'is not filled on the config file for XPUSH Session Server.\n refer to your facebook developer site(https://developers.facebook.com).';
    console.error(errMessage);

  }else{

    var authUrl = conf.authUrl;
    if(_.isEmpty(conf.authUrl)) authUrl = '/auth/facebook';

    var callbackUrl = conf.callbackUrl;
    if(_.isEmpty(conf.callbackUrl)) callbackUrl = '/auth/facebook/callback';
    
    FacebookStrategy = require('passport-facebook').Strategy;
    passport.use(new FacebookStrategy({
        clientID:     conf.key,
        clientSecret: conf.secret,
        callbackURL:  conf.serverUrl + callbackUrl 
      },
      function(accessToken, refreshToken, profile, done) {
        /*console.log('##############');
        console.log('accessToken  : ', accessToken);
        console.log('refreshToken : ', refreshToken);
        console.log('profile      : ', profile);confconf
        console.log('##############'); */
        done(null, profile);
        /*User.findOrCreate(..., function(err, user) {
          if (err) { return done(err); }
          done(null, user);
        });*/
      }
    ));


    server.get(authUrl, 
      passport.authenticate('facebook', { session: false }));

    server.get(callbackUrl, 
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

    console.log(server);

    console.log('Facebook oauth >');
    console.log('        - url :  '+ conf.serverUrl + authUrl );
    console.log('   - callback :  '+ conf.serverUrl + callbackUrl );

  }

};



var _              = require('underscore');
var commonStorage  = require('../../server/common-storage');
var shortId        = require('shortid');
var serverUtils    = require('../../server/utils');

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


    server.get(authUrl+'/check',
      function (req, res) {

        var sid = shortId.generate();

        if(Object.keys(req.params).length > 0){
          commonStorage.set(sid, req.params, 20000);
        }

        res.writeHead(302, {
          'Set-Cookie': 'xpush-sid='+sid+';expires=0',
          'Location': authUrl
        });

        res.end();
      });

      server.get(authUrl+'/debug',
        function (req, res) {

          var cookieList = serverUtils.parseCookies(req);
          console.log(cookieList['xpush-sid']);
          console.log(commonStorage.get(cookieList['xpush-sid']));

          res.send(cookieList); //req.headers['Session-Id']);
        }
      );

    server.get(authUrl,
      function (req, res, next) {

        //Do Somethinggggggg.
        passport.authenticate('facebook', { session: false })(req, res);

      });

    server.get(callbackUrl,
      passport.authenticate('facebook', { session: false }),
      function(req, res) {

        var _r = server._fireEvent(
          'oauth',
          {provider: 'facebook', request: req, response: res}
        );

        if( !_r ){

          if(conf.event){

            var _sid = serverUtils.parseCookies(req)['xpush-sid'];
            if(_sid){
              var _params = commonStorage.get(_sid);
            }

            var datas = {
              name: conf.event.name,
              data: req.user
            };

            server.emit('XPUSH-send', datas);

          }

          res.send(req.user); // res.redirect('/A.html');
        }

      });

    console.log('Facebook oauth >');
    console.log('        - url :  '+ conf.serverUrl + authUrl );
    console.log('   - callback :  '+ conf.serverUrl + callbackUrl );

  }

};

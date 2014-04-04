var _          = require('underscore');
var commonStorage  = require('../../server/common-storage');
var shortId        = require('shortid');
var serverUtils    = require('../../server/utils');

exports.install = function (server, passport, conf){

  if(_.isEmpty(conf.clientId) || _.isEmpty(conf.clientSecret)){
    var errMessage = '';
    if(_.isEmpty(conf.clientId)) errMessage = errMessage + '["key": GooglePlus Client ID] ';
    if(_.isEmpty(conf.clientSecret)) errMessage = errMessage + '["secret": GooglePlus Client Secret] ';
    errMessage = errMessage + 'is not filled on the config file for XPUSH Session Server.\n refer to your Google developer site(https://console.developers.google.com).';
    console.error(errMessage);

  }else{

    var authUrl = conf.authUrl;
    if(_.isEmpty(conf.authUrl)) authUrl = '/auth/google';

    var callbackUrl = conf.callbackUrl;
    if(_.isEmpty(conf.callbackUrl)) callbackUrl = '/auth/google/callback';
    
    GooglePlusStrategy = require('passport-google-plus').Strategy;

    passport.use(new GooglePlusStrategy({
        clientId:     conf.clientId,
        clientSecret: conf.clientSecret,
        callbackURL:  conf.serverUrl + callbackUrl 
      },
      function(tokens, profile, done) {
        return done(err, profile, tokens);
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

    server.get(authUrl, 
      function (req, res, next) {
        passport.authenticate('google', { session: false })(req, res);
      });

    server.get(callbackUrl, 
      passport.authenticate('google', { session: false }),
      function(req, res) {

        var _r = server._fireEvent(
          'oauth',
          {provider: 'google', request: req, response: res}
        );

        if( !_r ){

          if(conf.event){

            var _sid = serverUtils.parseCookies(req)['xpush-sid'];

            if(_sid){
              var _params = commonStorage.get(_sid);

              var data = {
                app: _params.app,
                channel: _params.channel,
                id : _params.id,
                name: conf.event.name,
                data: req.user
              };

              server.emit('XPUSH-send', data);

            }

          }

          if(conf.success){
            res.end(conf.success);
          }else{
            res.end(req.user);
          }

        }

      });

    console.log('Google Plus oauth >');
    console.log('        - url :  '+ conf.serverUrl + authUrl );
    console.log('   - callback :  '+ conf.serverUrl + callbackUrl );

  }

};



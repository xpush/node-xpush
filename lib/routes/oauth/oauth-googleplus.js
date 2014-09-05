var _              = require('underscore');
var commonStorage  = require('../../server/common-storage');
var shortId        = require('shortid');
var serverUtils    = require('../../server/utils');

/**
 * Google+ 인증 처리를 위한 Module
 * @module
 * @name oauth-googleplus
 */
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

    var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
    passport.use(new GoogleStrategy({
        clientID:     conf.clientId,
        clientSecret: conf.clientSecret,
        callbackURL:  conf.serverUrl + callbackUrl
      },
      function(accessToken, refreshToken, profile, done) {
        process.nextTick(function () {
          return done(null, JSON.parse(profile._raw));
        });
      }
    ));

    /**
     * /auth/google/check REST API를 추가한다.
     * commonStorage에 session id를 저장한다.
     */
    server.get(authUrl+'/check',
      function (req, res) {

        var sid = shortId.generate();

        if(Object.keys(req.params).length > 0){
          commonStorage.set(sid, req.params, 20000);
        }

        // @todo check cookir expiration data !!!!!
        // 쿠키에 session id를 등록한다.
        res.writeHead(302, {
          'Set-Cookie': 'xpush-sid='+sid+'; expires='+new Date(new Date().getTime()+86409000).toUTCString(),
          'Location': authUrl
        });

        res.end();
      }
    );

    /**
     * /auth/google REST API를 추가한다.
     * passport 모듈을 사용하여 google 인증을 요청한다.
     */
    server.get(authUrl,
      passport.authenticate('google', { scope: ['https://www.googleapis.com/auth/userinfo.profile',
                                                'https://www.googleapis.com/auth/userinfo.email'] ,
                                        session: false }),
      function(req, res){
      }
    );

    /**
     * /auth/google/callback REST API를 추가한다.
     * passport 모듈을 사용하여 google 인증 완료 후 호출될 REST API
     */
    server.get(callbackUrl,
      passport.authenticate('google', { session: false }),
      function(req, res) {

        // `oauth` Event를 발생시켜서, 클라이언트는 해당 event를 받아 로그인 처리를 한다.
        var _r = server._fireEvent(
          'oauth',
          {provider: 'google', request: req, response: res}
        );

        if( !_r ){

          if(conf.event){

            var _sid = serverUtils.parseCookies(req)['xpush-sid'];

            if(_sid){
              var _params = commonStorage.get(_sid);

              if(_params){
                  var data = {
                  A : _params.app,
                  C : _params.channel,
                  SS: _params.socketId,
                  NM: conf.event.name,
                  DT: req.user
                };

                server.emit('XPUSH-send', data);
              }
            }
          }

          if(conf.success){
            res.end(conf.success);
          }else{
            res.end(req.user);
          }
        }
      }
    );

    console.log('Google Plus oauth >');
    console.log('        - url :  '+ conf.serverUrl + authUrl );
    console.log('   - callback :  '+ conf.serverUrl + callbackUrl );

  }
};
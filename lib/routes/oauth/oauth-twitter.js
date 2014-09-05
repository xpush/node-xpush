var _              = require('underscore');
var commonStorage  = require('../../server/common-storage');
var shortId        = require('shortid');
var serverUtils    = require('../../server/utils');

/**
 * twitter 인증 처리를 위한 Module
 * @module
 * @name oauth-facebook
 */
exports.install = function (server, passport, conf){

  if(_.isEmpty(conf.consumerKey) || _.isEmpty(conf.consumerSecret)){

    var errMessage = '';
    if(_.isEmpty(conf.consumerKey)) errMessage = errMessage + '["consumerKey": Twitter API ID] ';
    if(_.isEmpty(conf.consumerSecret)) errMessage = errMessage + '["consumerSecret": Twitter API Secret] ';
    errMessage = errMessage + 'is not filled on the config file for XPUSH Session Server.\n refer to your twitter developer site(https://dev.twitter.com).';
    console.error(errMessage);

  }else{

    var authUrl = conf.authUrl;
    if(_.isEmpty(conf.authUrl)) authUrl = '/auth/twitter';

    var callbackUrl = conf.callbackUrl;
    if(_.isEmpty(conf.callbackUrl)) callbackUrl = '/auth/twitter/callback';

    TwitterStrategy = require('passport-twitter').Strategy;
    passport.use(new TwitterStrategy({
        consumerKey:    conf.consumerKey,
        consumerSecret: conf.consumerSecret,
        callbackURL:    conf.serverUrl + callbackUrl
      },
      function(token, tokenSecret, profile, done) {
        return done(err, profile);
      }
    ));

    /**
     * /auth/twitter/check REST API를 추가한다.
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

    server.get(authUrl, passport.authenticate('twitter'));

    /**
     * /auth/twitter/callback REST API를 추가한다.
     * passport 모듈을 사용하여 facebook 인증 완료 후 호출될 REST API
     */
    server.get(callbackUrl,
      passport.authenticate('twitter'),
      function(req, res) {

        // `oauth` Event를 발생시켜서, 클라이언트는 해당 event를 받아 로그인 처리를 한다.
        var _r = server._fireEvent(
          'oauth', {provider: 'twitter', request: req, response: res}
        );

        if( !_r ){

          if(conf.event){

            var _sid = serverUtils.parseCookies(req)['xpush-sid'];

            if(_sid){
              var _params = commonStorage.get(_sid);
              if(_params){
                var data = {
                  app: _params.app,
                  channel: _params.channel,
                  socketId: _params.socketId,
                  name: conf.event.name,
                  data: req.user
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

    console.log('Twitter oauth >');
    console.log('        - url :  '+ conf.serverUrl + authUrl );
    console.log('   - callback :  '+ conf.serverUrl + callbackUrl );

  }
};
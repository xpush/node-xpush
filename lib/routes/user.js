// # User API
var restify        = require('restify'),
    utils          = require('../server/utils'),
    mongoPersister = require('../mongodb-persister/mongoPersister');


// ### <code>GET</code> /user/info/:userId
//
// - *<code>PARAM</code> app* : application name
// - *<code>URI</code> userId* : user id
exports.retrieve = function (req, res) { 

  mongoPersister.retrieveUser(
    req.params.app, 
    req.params.userId, 
    function (err, user, msg) {

    if(err){
      console.log(err);
      res.send({status: 'error', message: err});
    }else{
      res.send({status: 'ok', result: user});
    }

  });

};


// ### <code>POST</code> /user/register
//
// - *<code>PARAM</code> app* : application name
// - *<code>PARAM</code> userId* : user id
// - *<code>PARAM</code> deviceType* : web / android / iphone 
// - *<code>PARAM</code> deviceId* : device id (unique key) (optional)
// - *<code>PARAM</code> notiId* : notification token key (optional)
// - *<code>PARAM</code> datas* : additional data (JSON Object) (optional)
exports.register = function (req, res, next) {

  var err = utils.validEmptyParams(req, ['app', 'userId','deviceType']);

  if(err){
   next(err);
   return;
  }

  var _param = req.params;
  mongoPersister.registerUser(
    _param.app, 
    _param.userId, 
    _param.deviceType, 
    _param.deviceId,
    _param.notiId, 
    _param.datas,
    function (err, msg) {
    
    if(err){
      res.send({status: 'error', message: err});
    }else{
      res.send({status: 'ok'});
    }
  });

};


// ### <code>POST</code> /user/login
//
// - *<code>PARAM</code> app* : application name
// - *<code>PARAM</code> userId* : user id
exports.login = function (req, res, next) {

  var err = utils.validEmptyParams(req, ['app', 'userId']);

  if(err){
   next(err);
   return;
  }

  var _param = req.params;

  mongoPersister.createUserSessionId(_param.app, _param.userId, function (err, sessionId) {

    if(err){
      console.log(err);
      res.send({status: 'error', message: err});
    }else{
      res.send({status: 'ok', result: {'sessionId': sessionId}});
    }

  });
  
};


// ### <code>POST</code> /user/logout
//
// - *<code>PARAM</code> app* : application name
// - *<code>PARAM</code> userId* : user id
exports.logout = function (req, res, next) {

  var err = utils.validEmptyParams(req, ['app', 'userId']);

  if(err){
    next(err);
    return;
  }

  var _param = req.params;

  mongoPersister.removeUserSessionId(_param.app, _param.userId, function (err) {
    if(err){
      console.log(err);
      res.send({status: 'error', message: err});
    }else{
      res.send({status: 'ok'});
    }
  });
  
};

exports.search = function (req, res, next) {

  var err = utils.validEmptyParams(req, ['app']);

  if(err){
    next(err);
    return;
  }

  var _param = req.params;

  mongoPersister.searchUser(_param.app, _params.keys, _params.values, function (err, users) {

    if(err){
      console.log(err);
      res.send({status: 'error', message: err});
    }else{
      res.send({status: 'ok', result: users});
    }

  });
};

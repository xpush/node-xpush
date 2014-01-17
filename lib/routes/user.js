// # User API
var restify = require('restify'),
    mongoPersister = require('../mongodb-persister/mongoPersister');


// ### <code>GET</code> /user/:userId
//
// - *<code>PARAM</code> app* : application name
// - *<code>URI</code> userId* : user id
exports.retrieve = function (req, res, next) { 

  mongoPersister.retrieveUser(
    req.params.app, 
    req.params.userId, 
    function (err, user, msg) {

    if(err){
      console.log(err);
      next(err);
    }else{
      if(user){
        res.send(user);
      }else{
        res.send(msg);
      }
      next();
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
  console.log(req.params);
  var _param = req.params;


  if (_param.app === undefined) {
    return next(new restify.InvalidArgumentError('App must be supplied'))
  }
  if (_param.userId === undefined) {
    return next(new restify.InvalidArgumentError('User Id must be supplied'))
  }
  if(_param.deviceType === undefined) {
    return next(new restify.InvalidArgumentError('Device Type must be supplied'))
  }

  mongoPersister.registerUser(
    _param.app, 
    _param.userId, 
    _param.deviceType, 
    _param.deviceId,
    _param.notiId, 
    _param.datas,
    function (err, msg) {

    if(err) next(err);
    console.log('1' +' : ' + msg);
    res.send(msg);

  });

};


// ### <code>POST</code> /user/login
//
// - *<code>PARAM</code> app* : application name
// - *<code>PARAM</code> userId* : user id
exports.login = function (req, res, next) {
  var _param = req.params;

  if (_param.app === undefined) {
    return next(new restify.InvalidArgumentError('App must be supplied'))
  }
  if (_param.userId === undefined) {
    return next(new restify.InvalidArgumentError('User Id must be supplied'))
  }

  mongoPersister.createUserSessionId(_param.app, _param.userId, function (err, sessionId) {
    if(err) next(err);
    res.send({'sessionId': sessionId});
  });
  
};


// ### <code>POST</code> /user/logout
//
// - *<code>PARAM</code> app* : application name
// - *<code>PARAM</code> userId* : user id
exports.logout = function (req, res, next) {
  var _param = req.params;

  if (_param.app === undefined) {
    return next(new restify.InvalidArgumentError('App must be supplied'))
  }
  if (_param.userId === undefined) {
    return next(new restify.InvalidArgumentError('User Id must be supplied'))
  }

  mongoPersister.removeUserSessionId(_param.app, _param.userId, function (err) {
    if(err) next(err);
    res.send({message:'success'});
  });
  
};

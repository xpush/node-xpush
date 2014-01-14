var restify = require('restify'),
    mongoPersister = require('../mongodb-persister/mongoPersister');


exports.getUser = function (req, res, next) { 

  mongoPersister.retrieveUser(
    req.params.app, 
    req.params.userId, 
    function (err, user, msg) {

    if(err) next(err);
    if(user){
      res.send(user);
    }else{
      res.send(msg);
    }

  });

};

exports.registerUser = function (req, res, next) {
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
//if (_param.deviceId === undefined) {
//  return next(new restify.InvalidArgumentError('Device Id must be supplied'))
//}

  mongoPersister.registerUser(
    _param.app, 
    _param.userId, 
    _param.deviceType, 
    _param.deviceId,
    _param.notiId, 
    _param.datas,
    function (err, msg) {

    if(err) next(err);
    res.send(msg);

  });

};

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

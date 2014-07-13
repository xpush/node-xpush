var restify = require('restify'),
    mongoPersister = require('../mongodb-persister/mongoPersister');

// @ TODO not usred!! Is it deprecated ?
/*
exports.create = function (req, res, next){
  var _param = req.params;

  if (_param.app === undefined) {
    return next(new restify.InvalidArgumentError('App must be supplied'))
  }
  mongoPersister.createChannel({ // A, C, U, DT
    A: _param.app,
    C: _param.channel, // optional (can auto-generate !)
    U: _param.userIds
  },
  function (err, channel) {
    if(err) next(err);
      res.send({err: err, result: channel } );
  });
};

exports.join = function (req, res, next){

  var _param = req.params;

  if (_param.app === undefined) {
    return next(new restify.InvalidArgumentError('App must be supplied'))
  }
  if (_param.channel === undefined) {
    return next(new restify.InvalidArgumentError('Channel must be supplied'))
  }

  mongoPersister.joinChannel(_param.app, _param.channel, _param.sessionId, function (err,msg) {
    if(err) next(err);
    res.send(msg);
  });

};


exports.list = function (req, res, next){
  var _param = req.query;

  if (_param.app === undefined) {
    return next(new restify.InvalidArgumentError('App must be supplied'))
  }
  if (_param.userId === undefined) {
    return next(new restify.InvalidArgumentError('UserId must be supplied'))
  }

  mongoPersister.listChannel({
    A: _param.app,
    U: _param.userId
  }, function (err,msg) {
    if(err) next(err);
    res.send(msg);
  });

};
*/

// # Channel API 
var restify = require('restify'),
    mongoPersister = require('../mongodb-persister/mongoPersister');

// ### <code>POST</code> /channel/create/:channel
// - *<code>PARAM</code> app* : application name 
// - *<code>URI</code> channel* : channel name to broadcast messages 
exports.create = function (req, res, next){
  var _param = req.params;

  if (_param.app === undefined) {
    return next(new restify.InvalidArgumentError('App must be supplied'))
  }

  mongoPersister.createChannel(_param.app, _param.channel, function (err, channel) {
    if(err) next(err);
    res.send(channel);
  });
};

// ### <code>POST</code> /channel/join/:channel
// - *<code>PARAM</code> app* : application name 
// - *<code>URI</code> channel* : channel name to broadcast messages 
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

// ### <code>POST</code> /channel/list/:userId
// - *<code>PARAM</code> app* : application name 
// - *<code>URI</code> userId* : user id in the channels 
exports.list = function (req, res, next){

  var _param = req.params;

  if (_param.app === undefined) {
    return next(new restify.InvalidArgumentError('App must be supplied'))
  }
  if (_param.userId === undefined) {
    return next(new restify.InvalidArgumentError('UserId must be supplied'))
  }

  mongoPersister.getChannelsByUserId(_param.app, _param.userId, function (err,msg) {
    if(err) next(err);
    res.send(msg);
  });
  
};


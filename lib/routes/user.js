// # User API
var
restify        = require('restify'),
utils          = require('../server/utils'),
mongoPersister = require('../mongodb-persister/mongoPersister');


exports.register = function (req, res, next) {

  var err = utils.validEmptyParams(req, ['A', 'U','D']);
  if (err) {
    res.send({ status: 'ERR-PARAM', message: err });
    return;
  }

  var _param = req.params;

  mongoPersister.registerUser({ //// A, U, PW, DT, D
    A : _param.A,
    U : _param.U,
    PW: utils.encrypto(_param.PW),
    D : _param.D,
    N : _param.N,
    DT: _param.DT
  },
  function (err, msg) {
    if(err){
      SvrUtils.sendErr(res, err);
    }else{
      res.send({status: 'ok'});
    }
  });

};

exports.update = function(req, res, next){
  var err = utils.validEmptyParams(req, ['A','U','D','PW']);
  if (err) {
    res.send({ status: 'ERR-PARAM', message: err });
    return;
  }

  var _param = req.params;

  mongoPersister.updateUser({
      A : _param.A,
      U : _param.U,
      D : _param.D,
      PW: utils.encrypto( _param.PW ),
      N : _param.N,
      DT: _param.DT,
    },
    function(err, msg){
      if(err){
        if(err == 'ERR-PASSWORD' || err == 'ERR-NOTEXIST') {
          res.send({status: err, message: 'update process is failed'});
        }else{
          SvrUtils.sendErr(res, err);
        }
      }else{
        res.send({status: 'ok', user : msg});
      }
    });
  }

  /*
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

_keys = [];
_values = [];
if(req.params.keys) {
_keys = req.params.keys.split('^');
_values = req.params.values.split('^');
}

mongoPersister.searchUser(req.params.app, _keys, _values, function (err, users) {

if(err){
console.log(err);
res.send({status: 'error', message: err});
}else{
res.send({status: 'ok', result: users});
}

});
};
*/

var User     = require('./user'),
    Channel  = require('./channel'),
    Message  = require('./message'),



// User

exports.registerUser = function (_app, _userId, _deviceType, _deviceId, _notiId, _datas, done) {
  var user = new User({
    app         : _app,
    userId      : _userId,
    deviceType  : _deviceType,
    deviceId    : _deviceId,
    notiId      : _notiId,
    datas       : _datas
  });
  
  var query = { app        : _app, 
                userId     : _userId, 
                deviceType : _deviceType, 
                deviceId   : _deviceId};

  User.findOne(query, function(err, doc){
    if (err) {
      return done(err);
    }
    if(!doc){
      user.save();
    }else{
      doc.notiId = _notiId;
      doc.datas  = _datas;
      doc.save();
    }
  });
  
  return done(null, { message: 'Regist User Success' });
};


exports.retrieveUser = function (_app, _userId, done) {

  User.find({app: _app, userId: _userId}, function (err, user) {
    if (err) {
      return done(err);
    }

    if (!user) {
      return done(null, false, { message: 'User not found' });
    }

    return done(null, user);

  });

};


// Channel 

exports.createChannel = function (_app, _channel, _sessionId, done) {

  var channel = new Channel({
    app : _app,
    channel : _channel,
    sessionId : _sessionId
  });

  channel.save(done);

};

exports.joinChannel = function (_app, _channel, _sessionId, done) {

  var channel = new Channel({
    app : _app,
    channel : _channel,
    sessionId : _sessionId
  });

  channel.save(done);

};



// TODO !! add methods .... 

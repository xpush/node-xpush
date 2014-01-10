var User     = require('./user'),
    Channel  = require('./channel'),
    Message  = require('./message'),
    shortId  = require('shortid');

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
      user.save(done);
    }else{
      doc.notiId = _notiId;
      doc.datas  = _datas;
      doc.save(done);
    }
  });
  
  //return done(null, { message: 'Regist User Success' });
};

exports.retrieveUser = function (_app, _userId, done) {

  User.findOne({app: _app, userId: _userId}, function (err, user) {
    if (err) {
      return done(err);
    }

    if (!user) {
      return done(null, false, { message: 'User not found' });
    }

    return done(null, user);

  });

};

exports.createUserSessionId = function (_app, _userId, done) {
  var _sessionId = shortId.generate(); 
  User.update({app:_app, userId:_userId}, {$set: { sessionId: _sessionId }}, {upsert: false}, function(err) {
    if (err) {
      return done(err);
    }

    done(null, _sessionId);
  });
};

exports.removeUserSessionId = function (_app, _userId, done) {
   
  User.update({app:_app, userId:_userId}, {$set: { sessionId: null }}, {upsert: false}, function(err) {
    if (err) {
      return done(err);
    }

    done(null);
  });
};


// Channel 

exports.createChannel = function (_app, _channel, _sessionId, done) {

  var newChannel = {
    app : _app,
    sessionId : _sessionId
  };

  if(!_channel){

    newChannel.channel = shortId.generate(); 
    var _c = new Channel(newChannel);
    _c.save(done);

  }else{
    
    var query = { app        : _app, 
                  channel    : _channel }; 

    Channel.findOne(query, function(err, doc){

      if (err){
        return done(err);
      }

      if(!doc){
        newChannel.channel = _channel; 
        var _c = new Channel(newChannel);
        _c.save(done);

      }else{
        done({message:'channel is existed'});

      }
    });

  }

};

exports.joinChannel = function (_app, _channel, _sessionId, done) {

  var channel = new Channel({
    app : _app,
    channel : _channel,
    sessionId : _sessionId
  });

  channel.save(done);

};


// Message

exports.createMessage = function (_app, _channel, _senderObj, _receiverObj, _deviceObj, _message, done) {
  
  var message = new Message({
    app: _app,
    channel: _channel,
    sender: _senderObj,
    receiver: receiverObj,
    device: deviceObj,
    message: _message
  });

  message.save(done);  
};

exports.getMessagesByUserId = function (_app, _channel, _receiverUserId, done) {
  
  Message.find({app: _app, channel: _channel, 'receiver.userId': _receiverUserId }, function (err, message) {
    if (err) {
      return done(err);
    }

    if (!message) {
      return done(null, false, { message: 'Message not found' });
    }

    return done(null, message);
  });
};





var User     = require('./user'),
    Channel  = require('./channel');
    Message  = require('./message');



// User

exports.registerUser = function (/*arguments? */) {

// TODO !! Validation !!  

  var user = new User({
// TODO !!! 
  });

  user.save();
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

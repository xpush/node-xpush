var User     = require('./user'),
    Message  = require('./message');

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


// TODO !! add methods .... 

var mongoose = require('mongoose');

var userModel = function () {

  var userSchema = mongoose.Schema({
    app: String,
    userId: String,
    deviceType : String,
    deviceId : String,
    notiId : String,
    sessionId : String,
    datas : {},
    created: { type: Date, default: Date.now },
    updated: { type: Date }
  });

  userSchema.pre('update', function (next) {

    this.update = new Date();

    next();
  });

  return mongoose.model('User', userSchema);
};

module.exports = new userModel();

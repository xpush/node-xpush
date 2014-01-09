var mongoose = require('mongoose');

var userModel = function () {

  var userSchema = mongoose.Schema({
    app: String,
    userId: String,
    deviceType : String,
    deviceId : String,
    notiId : String,
    datas : {},
    created: { type: Date, default: Date.now }
  });

  return mongoose.model('User', userSchema);
};

module.exports = new userModel();

var mongoose = require('mongoose');

var userModel = function () {

  var userSchema = mongoose.Schema({
    app: String,
    channel: String,
    sender: {},
    receiver: {},
    device: {},
    message: String,
    created: { type: Date, default: Date.now }
  });

  return mongoose.model('User', userSchema);
};

module.exports = new userModel();

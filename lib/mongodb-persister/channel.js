var mongoose = require('mongoose');


var channelModel = function () {

  var userSchema = mongoose.Schema({
    userId: String, 
    sessionId: String,
    deviceType: String,
    deviceId: String,
    notiId: String
  });

  var channelSchema = mongoose.Schema({
    app: String,
    channel: String,
    users: [userSchema],
    created: { type: Date, default: Date.now }
  });

  return mongoose.model('Channel', channelSchema);
};

module.exports = new channelModel();

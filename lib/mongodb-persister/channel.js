var mongoose = require('mongoose');


var channelModel = function () {

  var userSchema = mongoose.Schema({
    userId: String, 
    sessionId: String
  });

  var channelSchema = mongoose.Schema({
    app: String,
    channel: String,
    users: [userSchema],
    count: { type: Number, default: 0 }
  });

  channelSchema.pre('save', function (next) {
    var channel = this;

    if(channel.users) channel.count = channel.users.length;
    next();
  });


  return mongoose.model('Channel', channelSchema);
};

module.exports = new channelModel();

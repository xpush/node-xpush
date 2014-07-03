var mongoose = require('mongoose');


var channelModel = function () {

  var userSchema = mongoose.Schema({
    userId: { type: String, required: true, trim: true },
    deviceId: { type: String, required: true, trim: true },
    notiId: String
  }, { _id : false });

  var channelSchema = mongoose.Schema({
    app: { type: String, required: true, trim: true },
    channel: { type: String, required: true, trim: true },
    users: [userSchema],
    datas: {},
    created: { type: Date, default: Date.now }
  });

  return mongoose.model('Channel', channelSchema);
};

module.exports = new channelModel();

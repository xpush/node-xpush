var mongoose = require('mongoose');


var messageModel = function () {

  var messageSchema = mongoose.Schema({

  	app: String,
    channel: String,
    userId: String,
    deviceId: String,
    data: {},
    created: { type: Number, default: Date.now }
  });

  return mongoose.model('Message', messageSchema);
};

module.exports = new messageModel();

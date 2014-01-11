var mongoose = require('mongoose');


var messageModel = function () {

  var messageSchema = mongoose.Schema({
    app: String,
    channel: String,
    sender: {},
    receiver: {},
    message: String,
    created: { type: Date, default: Date.now }
  });

  return mongoose.model('Message', messageSchema);
};

module.exports = new messageModel();

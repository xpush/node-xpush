var mongoose = require('mongoose');


var unreadMessageModel = function () {

  var unreadMessageSchema = mongoose.Schema({

  	app:       { type: String, required: true, trim: true }, 
    channel:   { type: String, required: true, trim: true }, 
    userId:    { type: String, required: true, trim: true }, 
    deviceId:  { type: String, required: true, trim: true }, 
    messageId: mongoose.Schema.ObjectId,
    created:   { type: Date, default: Date.now }
  });

  return mongoose.model('UnreadMessage', unreadMessageSchema);
};

module.exports = new unreadMessageModel();
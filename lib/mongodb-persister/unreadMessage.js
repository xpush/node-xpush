var mongoose = require('mongoose');


var unreadMessageModel = function () {

  var unreadMessageSchema = mongoose.Schema({

  	A : { type: String, required: true, trim: true }, // app
    C : { type: String, required: true, trim: true }, // channel
    U : { type: String, required: true, trim: true }, // userId
    D : { type: String, required: true, trim: true }, // deviceId
    NM: { type: String, required: true, trim: true }, // name
    MG: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' }, // message
    TS: { type: Number } // timestamp
  });

  return mongoose.model('UnreadMessage', unreadMessageSchema);
};

module.exports = new unreadMessageModel();

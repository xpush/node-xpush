var mongoose = require('mongoose');


var messageModel = function () {

  var messageSchema = mongoose.Schema({
  	A : String, // app
    C : String, // channel
    U : String, // userId
    D : String, // deviceId
    DT: {}, // data
    CD: { type: Number } // created
  });

  return mongoose.model('Message', messageSchema);
};

module.exports = new messageModel();

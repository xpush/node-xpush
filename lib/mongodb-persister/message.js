var mongoose = require('mongoose'),
    paginate = require('./paginate');

var messageModel = function () {

  var messageSchema = mongoose.Schema({
  	A : String, // app
    C : String, // channel
    U : String, // userId
    D : String, // deviceId
    DT: {}, // data
    CD: { type: Number } // created
  });

  messageSchema.plugin(paginate);

  return mongoose.model('Message', messageSchema);
};

module.exports = new messageModel();

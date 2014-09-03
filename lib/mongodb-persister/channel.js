var mongoose = require('mongoose');

/**
 * Channel 정보를 담기 위한 Mongo DB model
 * @name channelModel
 */
var channelModel = function () {

  var userSchema = mongoose.Schema({
    U: { type: String, required: true, trim: true }, // userId
    D: { type: String, required: true, trim: true }, // deviceId
    N: String // notiId
  }, { _id : false });

  var channelSchema = mongoose.Schema({
   _id: { type: String, required: true}, // A+C (for find performance)
    A:  { type: String, required: true, trim: true }, // app
    C:  { type: String, required: true, trim: true }, // channel
    US: [userSchema], // users
    DT: {}, // datas
    CD: { type: Date, default: Date.now } // created
  });

  return mongoose.model('Channel', channelSchema);
};

module.exports = new channelModel();

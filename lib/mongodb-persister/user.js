var mongoose = require('mongoose');

var userModel = function () {

  var userSchema = mongoose.Schema({
    app: { type: String, required: true, trim: true },
    userId: { type: String, required: true, trim: true },
    password: String,
    deviceId : { type: String, required: true, trim: true },
    notiId : String,
    token : String,
    datas : {},
    created: { type: Date, default: Date.now },
    updated: { type: Date }
  });

  userSchema.pre('update', function (next) {

    this.update = new Date();

    next();
  });

  return mongoose.model('User', userSchema);
};

module.exports = new userModel();

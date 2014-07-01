var mongoose = require('mongoose');

var userModel = function () {

  var userSchema = mongoose.Schema({
    app: { type: String, required: true, trim: true },
    userId: { type: String, required: true, trim: true },
    password: String,
    devices : {},
    datas : {},
    groups : [],
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

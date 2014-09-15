var mongoose = require('mongoose'),
    paginate = require('./paginate');

var userModel = function () {

  var userSchema = mongoose.Schema({
    A : { type: String, required: true, trim: true }, // app
    U : { type: String, required: true, trim: true }, // userId
    PW: String, // password
    DS: {},     // devices
    DT: {},     // datas
    GR: [],     // groups
    CD: { type: Date, default: Date.now }, // created
    UD: { type: Date } // updated
  },{strict: false});

  userSchema.pre('update', function (next) {
    this.update = new Date();
    next();
  });

  userSchema.plugin(paginate);

  return mongoose.model('User', userSchema);
};

module.exports = new userModel();

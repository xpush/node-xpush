var mongoose = require('mongoose'),
    paginate = require('./paginate');

var sessionUserModel = function () {


  
  

  var sessionUserSchema = mongoose.Schema({
    A : { type: String, required: true, trim: true }, // app
    C:  { type: String, required: true, trim: true }, // channel
    US: [mongoose.Schema.Types.Mixed], // users
  },{strict: false});

  sessionUserSchema.pre('update', function (next) {
    this.update = new Date();
    next();
  });

  sessionUserSchema.plugin(paginate);

  return mongoose.model('SessionUser', sessionUserSchema);
};

module.exports = new sessionUserModel();

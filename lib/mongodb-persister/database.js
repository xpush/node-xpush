var mongoose = require('mongoose');

var db = function () {
  return {

    config: function (addr, dbname) {
        

     if(addr){
       mongoose.connect('mongodb://' + address + '/' + dbname);
     }else{
       mongoose.connect('mongodb://localhost:27017/xpush');
     }
 
     var db = mongoose.connection;

     db.on('error', console.error.bind(console, 'connection error:'));
       db.once('open', function callback() {
         console.log('db connection open');
       });
     }

  };
};

module.exports = db();

var mongoose = require('mongoose');

var db = function () {
  return {

    config: function (addr, dbname) {

     var connectUrl = 
       'mongodb://'+
       (addr?addr:'localhost:27017')+
       '/'+
       (dbname?dbname:'xpush');


     mongoose.connect(connectUrl);

     var db = mongoose.connection;

     db.on('error', function (err) {
       // 왜 이 이벤트는 안타지?       
       console.log('DDDD : '+err);
       //console.error.bind(console, 'mongodb connection error:');
     });
     db.once('open', function callback() {
       console.log('mongodb connection open');
     });


   }

  };
};

module.exports = db();

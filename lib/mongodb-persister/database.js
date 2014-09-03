var mongoose = require('mongoose');

// @ TODO remove for production level.
mongoose.set('debug', true);

var db = function() {
  return {

    config: function(addr, dbname, opts, callback) {
      var connectUrl = 'mongodb://' + (addr ? addr : 'localhost:27017') + '/' + (dbname ? dbname : 'xpush');
      mongoose.connect(connectUrl, (opts ? opts : {}));

      var db = mongoose.connection;

      db.on('error', function(err) {
        console.log('Mongodb error encountered [' + err + ']');
        if (callback) callback(err, 'connect');
        //console.error.bind(console, 'mongodb connection error:');
      });

      db.once('open', function() {
        console.log('Mongodb connect');
        if (callback) callback(null, 'connect');
      });
    }
  };
};

module.exports = db();
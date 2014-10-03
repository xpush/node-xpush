var mongoose = require('mongoose');

// @ TODO remove for production level.
//mongoose.set('debug', true);

var db = function() {
  return {

    config: function(addr, dbname, opts, callback) {
      var connectUrl = 'mongodb://' + (addr ? addr : 'localhost:27017') + '/' + (dbname ? dbname : 'xpush');
      mongoose.connect(connectUrl, (opts ? opts : {}));

      var db = mongoose.connection;

      db.on('error', function(err) {
        // Connection Error
        console.log('Mongodb error encountered [' + err + ']');

        if (callback) {
          callback('ERR-MONGODB', 'mongodb - '+err.message);
        }
      });

      db.once('open', function() {
        if (callback) callback(null);
      });
    }

  };
};

module.exports = db();

var async = require('async');

function paginate(q, pageNumber, resultsPerPage, callback, options) {
  var query, skipFrom, sortBy, columns, populate, model = this;
  options = options || {};
  columns = options.columns || null;
  sortBy = options.sortBy || {
    _id : 1
  };
  populate = options.populate || null;
  callback = callback || function() {};
  skipFrom = (pageNumber * resultsPerPage) - resultsPerPage;
  query = model.find(q);
  if (columns !== null) {
    query = query.select(options.columns);
  }
  query = query.skip(skipFrom).limit(resultsPerPage).sort(sortBy);
  if (populate) {
    query = query.populate(populate);
  }
  async.parallel({
    results: function(callback) {
      query.exec(callback);
    },
    count: function(callback) {
      if(options.skipCount){
        callback(null, 0);
      }else{
        model.count(q, function(err, count) {
          callback(err, count);
        });
      }
    }
  }, function(error, data) {
    if (error) {
      return callback(error);
    }
    callback(null, Math.ceil(data.count / resultsPerPage) || 1, data.results, data.count);
  });
}

module.exports = function(schema) {
  schema.statics.paginate = paginate;
}

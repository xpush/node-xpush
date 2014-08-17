var shortId = require('shortid'),
		async 	= require('async'),
		_ 			= require('underscore'),
		User 		= require('./user'),
    Channel = require('./channel'),
  	Message = require('./message'),
  	utils 	= require('../server/utils'),
		UnreadMessage = require('./unreadMessage');


exports.registerUser = function(input, done) { // A, U, PW, DT, D, N

  var query = { A: input.A, U: input.U };
  var data = {
    PW: input.PW,
    DT: input.DT,
    GR: []
  };
  data['DS.' + input.D + '.N'] = input.N;

  User.update(query, { '$set': data }, { upsert: true }, function(err) {
    if (err) return done(err);
    if (done) done(null);
	});

};

// @ TODO Expose REST API
exports.addDevice = function(input, done) { // A, U, D, N

  var query = { A: input.A, U: input.U };
  var data = {};
  data['DS.' + input.D + '.N'] = input.N;

  User.update(query, { '$set': data }, { upsert: true }, function(err) {
	  if (err) return done(err);
	  if (done) done(null);
	});

};

exports.updateUser = function(input, done) { // A, U, D, PW, N, DT

	var query = { A: input.A, U: input.U };
	if (input.D) {
		query['DS.' + input.D] = { '$exists': true };
	}

	User.findOne(query, function(err, user) {
		if (err) return done(err);
		if (!err && !user) {
			return done('ERR-NOTEXIST');
		}
		if (user.PW != input.PW) {
			return done('ERR-PASSWORD');
		}

		user.N  = input.N;
		user.DT = input.DT;

		user.save(function(err) {
			if (err) return done(err);
			user.PW = undefined;
			done(null, user);
		});
	});
};

exports.retrieveUser = function(input, done) { // A, U, D

  var query = { A: input.A, U: input.U };
  if (input.D) {
    query['DS.' + input.D] = { '$exists': true };
  }

  User.findOne(query).lean().exec(function(err, user) {
    if (err) return done(err);
    return done(null, user);
  });
};

exports.updateUserToken = function(input, done) { // A, U, D, TK

  var query = { A: input.A, U: input.U };
  query['DS.' + input.D] = { '$exists': true };

  var data = {};
  data['DS.' + input.D + '.TK'] = input.TK;

  User.update(query, { '$set': data }, { upsert: false }, function(err) {
    if (err) return done(err);
    done(null, input.TK);
  });

};

exports.addGroupId = function(input, done) { // A, U, GR
  var query = { A: input.A };

  if (typeof input.U == 'string') {
    query['U'] = input.U;
  } else {
    if (input.U.length == 1) {
      query['U'] = input.U[0];
    } else if (input.U.length > 1) {
      query['$or'] = [];
      for (var i in input.U) {
        query['$or'].push({ U: input.U[i] });
      }
    }
  }

  var data = { '$addToSet': { 'GR': input.GR } };

  User.update(query, data, { upsert: true, multi: true }, function(err) {
    if (err) {
      return done(err);
    }
    done(null, input.GR);
  });
};

exports.removeGroupId = function(input, done) { // A, U, GR
	var query = { A: input.A, U: input.U };

  var data = { '$pull': { 'GR': input.GR } };

  User.update(query, data, { multi: true }, function(err) {
    if (err) {
      return done(err);
    }
    done(null, input.GR);
  });
};

exports.listGroup = function(input, done) { // A, GR
  var query = { A: input.A, GR: input.GR };

  User.find( query, { U: 1, DT: 1, _id: 0 }, function(err, users) {
    if (err) {
			return done(err);
		}
    return done(null, users);
  });
};

// ** DEPLICATED **
exports.searchUser = function(_A, _keys, _values, _pageObj, done) {

	var isPaging = false;
	if(typeof(_pageObj) == 'function' && !done){
		done = _pageObj; _pageObj = undefined;
	}else{
		if(!_pageObj.num || !_pageObj.size) return done('ERR-NOTVAILDPARAM-PAGE');
		isPaging = true;
	}

  var query = { A: _A };

  if (_keys) {

    if (_keys.length != _values.length) return done('ERR-NOTVAILDPARAM');

    for (var i = 0; i < _keys.length; i++) {
      query[_keys[i]] = _values[i];
    }

  }

	if(isPaging){
		User.paginate(query, _pageObj.num, _pageObj.size, function(error, pageCount, paginatedResults, itemCount) {
		  if (error) {
		    return done(err);
		  } else {
				return done(null, paginatedResults, itemCount);
		  }
		}, { columns: { U: 1, DS: 1, DT: 1, _id: 0 }, sortBy : { U : 1 }, skipCount: true });

	}else{
	  User.find( query, { U: 1, DS: 1, DT: 1, _id: 0 }, function(err, users) {
	    if (err) {
				return done(err);
			}
	    return done(null, users);
	  });

	}

};

exports.queryUser = function(_A, _query, _column, _options, done) {

	var isPaging = false;
	if(_options.pageNum && _options.pageSize) isPaging = true;

	var query = _.extend(_query, { A: _A });

	if(isPaging){

		var addedOptions = {
			columns: _column,
			skipCount: false
		};

		if(_options.sortBy) 	 addedOptions['sortBy'] 	 = _options.sortBy;
		if(_options.skipCount) addedOptions['skipCount'] = _options.skipCount;

		User.paginate(query, _options.pageNum, _options.pageSize, function(error, pageCount, paginatedResults, itemCount) {
			if (error) {
				return done(err);
			} else {
				return done(null, paginatedResults, itemCount);
			}
		}, addedOptions);

	}else{
		User.find( query, _column, function(err, users) {
			if (err) {
				return done(err);
			}
			return done(null, users);
		});

	}
};


exports.createChannel = function(input, done) { // A, C, U, DT

  async.waterfall([

	  function(callback) {

	    var channel = {
				_id: input.A+'^'+input.C,
	      A : input.A,
	      C : input.C,
	      US: {}
	    };
			if (input.DT) channel['DT'] = input.DT;

	    if (input.U) {

	      var query = { A: input.A };
	      var isExistedUsers = false;
	      if (typeof input.U == 'string') {
	        query['U'] = input.U;
	        isExistedUsers = true;
	      } else {
	        if (input.U.length == 1) {
	          query['U'] = input.U[0];
	          isExistedUsers = true;
	        } else if (input.U.length > 1) {
	          query['$or'] = [];
	          for (var i in input.U) {
	            query['$or'].push({
	              U: input.U[i]
	            });
	          }
	          isExistedUsers = true;
	        }
	      }

	      if (isExistedUsers) {

	        User.find( query, { U: 1, DS: 1, _id: 0 }, function(err, doc) {

	          var result = [];
	          for (var i = 0; i < doc.length; i++) {
	            var devs = doc[i].DS;
	            var keys = Object.keys(devs);
	            keys.forEach(function(key) {
	              var _t = {};
	              _t['U'] = doc[i].U;
	              _t['D'] = key;
	              _t['N'] = devs[key].N;

	              result.push(_t);
	            });
	          }

	          if (err) done(err);
	          channel.US = result;
	          callback(null, channel);
	        });

	      } else {
	        callback(null, channel);
	      }

	    } else {
	      callback(null, channel);
	    }

	  },

	  function(newChannel, callback) {
	    if (!newChannel.C) {
	      newChannel.C = shortId.generate();
	      var _c = new Channel(newChannel);
	      _c.save(done);
	      callback(null, newChannel);

	    } else {

	      Channel.findOne({
	        A: input.A,
	        C: input.C
	      },
	      function(err, doc) {
	        if (err) return done(err);

	        if (!doc) {
	          var _c = new Channel(newChannel);
	          _c.save(done);
	          callback(null, newChannel);

	        }
	        else {
	          return done('ERR-EXISTED');
	        }

	      });
	    }
	  }
	], function(er, result) {

  });

};

exports.listChannel = function(input, done) { // A, U
  var query = { A: input.A, 'US.U': input.U };
  Channel.find(query, function(err, channels) {
    if (err) return done(err);

    if (!channels) {
      done(null, null, {
        message: 'Channel is not found'
      });
    }
    else {
      done(null, channels);
    }
  });
};

exports.getChannel = function(input, done) { // A, C
  var query = { A: input.A, C: input.C };
  Channel.findOne(query).lean().exec(function(err, channel) {
    if (err) return done(err);

    if (!channel) {
      done(null, null, {
        message: 'Channel is not found'
      });
    }
    else {
      done(null, channel);
    }
  });
};

exports.addChannelUser = function(input, done) { // A, C, U, DT

  async.waterfall([

	  function(callback) {

	    var query = { A: input.A };

	    if (typeof input.U == 'string') {
	      query['U'] = input.U;
	    } else {
	      if (input.U.length == 1) {
	        query['U'] = input.U[0];
	      } else if (input.U.length > 1) {
	        query['$or'] = [];
	        for (var i in input.U) {
	          query['$or'].push({ U: input.U[i] });
	        }
	      }
	    }

	    User.find( query, { U: 1, DS: 1, _id: 0 }, function(err, doc) {
		console.log("====== arguments",arguments);
	      var result = [];
	      for (var i = 0; i < doc.length; i++) {
	        var devs = doc[i].DS;
	        var keys = Object.keys(devs);
	        keys.forEach(function(key) {
	          var _t = {};
	          _t['U'] = doc[i].U;
	          _t['D'] = key;
	          _t['N'] = devs[key].N;
	          result.push(_t);
	        });
	      }

	      if (err) done(err);
	      callback(null, result);

	    });

	  },

		// @ TODO check update query !!!! Why too many queries need to be existed ?
	  function(users, callback) {
			var query  = { A: input.A, C: input.C };
			var update = { '$pullAll': { US: users } };
	    Channel.update(query, update, { "multi": true }, function(err, data) {
	      if (err) return done(err);
	      callback(null, users);
	    });
	  },

	  function(users, callback) {
			var query  = { A: input.A, C: input.C };
			var update = { '$pushAll': { US: users } };
			Channel.update(query, update, { "multi": true }, function(err, data) {
				if (err) return done(err);
				callback(null, users);
			});
	  },

	  function(users, callback) {
			var query  = { A: input.A, C: input.C };
			var update = { '$set': { DT: input.DT } };
			Channel.update(query, update, { "multi": true }, function(err, data) {
				if (err) return done(err);
				done(null, users);
			});
	  }
	], function(er, result) {

  });
};

exports.exitChannel = function(input, done) { // A, C, U

	var query  = {
		A: input.A,
		C: input.C,
		'US.U': input.U
	};
	var update = {
		'$pull': { US: { U: input.U } }
	};

	Channel.findOneAndUpdate(query, update, { "multi": true, "select": 'US' }, function(err, data) {
		if (err) {
			console.log(err);
			if (done) done(err);
		} else {

			console.log(data);
			//console.log(data.US);

			if(!data){
				if (done){
					return done('ERR-NOTEXIST', data);
				}else{
					return;
				}
			}

			if(!data.US || data.US.length === 0){

				Channel.remove({ _id: data._id }, function (err) {
					if (done) done(err);
				});
			}else{
				if (done) done(null, data);
			}
		}
	});

};

// @ TODO not used
exports.storeMessage = function(input, done) { // A, C, U, D, DT

  if (input.DT && typeof input.DT == 'object') {
    input.DT = JSON.stringify(input.DT);
  }

  var _m = new Message({
		A : input.A,
		C : input.C,
		U : input.U,
		D : input.D,
		DT: input.DT
  });

  if (done) {
    _m.save(done);
  } else {
    _m.save();
  }

};

exports.storeMessages = function(input, done) { // A, C, NM, DT, US, TS

	if (input.DT && typeof input.DT == 'object') {
		input.DT = JSON.stringify(input.DT);
	}

  var msg = new Message({
    DT: input.DT,
		TS: input.TS
  });

  msg.save(function(err, _message) {

    var unreadMsgs = [];

    for (var i = 0; i < input.US.length; i++) {
      var _unreadMsg = {
				A : input.A,
        C : input.C,
        U : input.US[i].U,
        D : input.US[i].D,
        NM: input.NM,  // @ TODO Is it necessary ? ,or remove !!
        MG: _message._id,
        TS: input.TS
      };
      unreadMsgs.push(_unreadMsg);
    }

    UnreadMessage.create(unreadMsgs, function(err) {
      if (err) {
        done(err);
      } else {
        done(null);
      }
    });
  });

};


exports.unReadMessages = function(input, done) { // A, C, U, D

  var queryCond = { A: input.A, U: input.U };
  if (input.C) queryCond['C'] = input.C;
  if (input.D) queryCond['D'] = input.D;

  UnreadMessage.find(queryCond, {'_id': 0,'NM': 1,'MG': 1,'TS': 1} ).populate('MG').exec(function(err, messages) {
    if (err) {
      done(err);
    } else {
      done(null, messages);
    }
  });

};

exports.removeUnReadMessages = function(input, done) { // A, C, U, D

	var queryCond = { A: input.A, U: input.U };
	if (input.C) queryCond['C'] = input.C;
	if (input.D) queryCond['D'] = input.D;

  UnreadMessage.remove(queryCond).exec(function(err) {
    if (err) {
      done(err);
    } else {
      done(null, 'ok');
    }
  });
};

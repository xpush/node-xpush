var shortId = require('shortid'),
		async 	= require('async'),
		_ 			= require('underscore'),
		User 		= require('./user'),
		SessionUser = require('./session-user'),

		
    Channel = require('./channel'),
  	Message = require('./message'),
  	utils 	= require('../server/utils'),
		UnreadMessage = require('./unreadMessage');

		// TODO mongo 에 사용자 목록 저장.
		// ObjectID, {app: , channel: ,userid: ,{datas}}
		// index 는 app, channel

/**
 * MongoDB의 data를 저장, 수정, 조회를 하기 위한 module
 * @module
 * @name mongoPerister
 */

/**
 * Active User를 등록한다.
 * @name addActiveUser
 * @function
 * @param {object} input - JSON 형태의 data
 * @param {callback} done - 등록 후 수행할 callback function
 */
exports.addActiveUser = function(input, done) { // A, C, U, DT

	var query ={A:input.A, C:input.C, U:input.U}; 
	var data = {A:input.A, C:input.C, U:input.U, DT:input.DT};
	
	SessionUser.findOne(query,function(err,au){
		if(err) return done(err);

		if(au){
			au.DT = data.DT;
			au.save(function(err,user){
				done(err,user);
			});
			
		}else{
			var newSessionUser = new SessionUser(data);
			newSessionUser.save(function(err, user) {
				done(err,user);
			});	
		}
	})
};


/**
 * TODO : Apply after row index

 * Active User를 
 * @name updateActiveUser
 * @function
 * @param {object} input - JSON 형태의 data
 * @param {callback} done - 등록 후 수행할 callback function
 */
exports.updateActiveUser = function(input, done) { // A, C, U, DT
	var data = {A:input.A, C:input.C,U:input.U};

	SessionUser.findOne(data,function(err,doc){
		if(err) return done(err);

		if(doc){
			for( var key in input.DT ){
				doc[key] = DT[key];
			}

			doc.save(function(err) {
				if (err) return done(err);
				done(null);
			});
		}
	});
};

/**
 * Active User를 삭젬한다.
 * @name removeActiveUser
 * @function
 * @param {object} input - JSON 형태의 data
 * @param {callback} done - 등록 후 수행할 callback function
 */
exports.removeActiveUser = function(input, done) { // A, U, GR
	console.log("remove active user");
	
	var query = { A: input.A, C: input.C ,U:input.U };
  
  
  
  SessionUser.remove(query, function (err) {
		if (done) done(err);
	});
  
};

/**
 * User 정보가 조회
 * @name retrieveActiveUser
 * @function
 * @param {object} input - JSON 형태의 data
 * @param {callback} done - 조회 후 수행할 callback function
 */
exports.retrieveActiveUser = function(input, done) { // A, C

  var query = { A: input.A, C: input.C };
  
  SessionUser.find(query, {'_id': 0, U:1, DT:1} ,function(err,doc){
	if(err) return done(err);
	return done(null, doc);
  });

 
};
/**
 * User를 등록한다.
 * @name registerUser
 * @function
 * @param {object} input - JSON 형태의 data
 * @param {callback} done - 등록 후 수행할 callback function
 */
exports.registerUser = function(input, done) { // A, U, PW, DT, D, N

  var query = { A: input.A, U: input.U };
  var data = {
    PW: input.PW,
    DT: input.DT,
    GR: []
  };

  // notiId는 DS.deviceId.N 형태로 저장됨. ex) DS.android01.N
	if( input.N ){
		data['DS.' + input.D + '.N'] = input.N;
	}  else {
		data['DS.' + input.D + '.N'] = null;
	}

  User.find(query,function(err,doc){
  	if(err) return done(err);
  	if(doc.length > 0 ){
  		return done('ERR-USER_EXIST');
  	}
  	for(var k in data){
  		query[k] = data[k];
  	}
		var newUser = new User(query);
		newUser.save(function(err) {
			if (err) return done(err);
			if (done) done(null);
		});
  });
  /*
  User.update(query, { '$set': data }, { upsert: true }, function(err) {
    if (err) return done(err);
    if (done) done(null);
	});
	*/
};

/**
 * User의 디바이스를 추가하거나 수정한다.
 * @name addDevice
 * @function
 * @param {object} input - JSON 형태의 data
 * @param {callback} done - device 등록 후 수행할 callback function
 */
exports.addDevice = function(input, done) { // A, U, D, N

  var query = { A: input.A, U: input.U };
  var data = {};
  data['DS.' + input.D + '.N'] = input.N;

  User.update(query, { '$set': data }, { upsert: true }, function(err) {
	  if (err) return done(err);
	  if (done) done(null);
	});
};

/**
 * User 정보가 있는지 확인 후에 있는 경우 수정한다. deviceId를 필수로 입력받아야 한다.
 * @name updateUser
 * @function
 * @param {object} input - JSON 형태의 data
 * @param {callback} done - 수정 후 수행할 callback function
 */
exports.updateUser = function(input, done) { // A, U, D, PW, N, DT

	var query = { A: input.A, U: input.U };
	if (input.D) {
		query['DS.' + input.D] = { '$exists': true };
	}

	// User 정보 조회
	User.findOne(query, function(err, user) {
		if (err) return done(err);
		if (!err && !user) {
			return done('ERR-NOTEXIST');
		}

		// PW가 동잃한지 비교한다.
		if (user.PW != input.PW) {
			return done('ERR-PASSWORD');
		}

		user.N  = input.N;
		user.DT = input.DT;

		user.save(function(err) {
			if (err) return done(err);
			//Return 할때 PW를 삭제하고 return함
			user.PW = undefined;
			done(null, user);
		});
	});
};

/**
 * User 정보가 조회
 * @name retrieveUser
 * @function
 * @param {object} input - JSON 형태의 data
 * @param {callback} done - 조회 후 수행할 callback function
 */
exports.retrieveUser = function(input, done) { // A, U, D

  var query = { A: input.A, U: input.U };
  if (input.D) {
    query['DS.' + input.D] = { '$exists': true };
  }

  // lean 함수를 이용하여 mongoose 객체를 JSON 형태로 변경함
  User.findOne(query).lean().exec(function(err, user) {
    if (err) return done(err);
    return done(null, user);
  });
};

/**
 * User 정보 중 login token 을 갱신한다.
 * @name updateUserToken
 * @function
 * @param {object} input - JSON 형태의 data
 * @param {callback} done - 수정 후 수행할 callback function
 */
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

/**
 * 하나 또는 다수의 User의 group id를 추가한다.
 * @name updateUserToken
 * @function
 * @param {object} input - JSON 형태의 data
 * @param {callback} done - 추기 후 수행할 callback function
 */
exports.addGroupId = function(input, done) { // A, U, GR
  var query = { A: input.A };

  if (typeof input.U == 'string') {
    query['U'] = input.U;
  } else {
  	// U 는 한명이거나 여러명일 수 있다. 여려명일 경우 or 조건으로 쿼리에 추가
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

/**
 * User 정보에서 group Id 를 제거한다.
 * @name updateUserToken
 * @function
 * @param {object} input - JSON 형태의 data
 * @param {callback} done - 제거 후 수행할 callback function
 */
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

/**
 * Group내 포함된 User 목록을 조회한다.
 * @name listGroup
 * @function
 * @param {object} input - JSON 형태의 data
 * @param {callback} done - 조회 후 수행할 callback function
 */
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

/**
 * User 목록을 조회한다. 페이징을 하거나 전체조회를 한다.
 * @name queryUser
 * @function
 * @param {string} _A - Appication Id
 * @param {object} _query - 조회조건으로 사용할 JSON 형태의 data
 * @param {object} _column - 조회결과에 포함될 column ( {'U' : 1, 'PW' : 0 } )
 * @param {object} _options - JSON 형태의 data
 * @param {callback} done - 조회 후 수행할 callback function
 */
exports.queryUser = function(_A, _query, _column, _options, done) {

	var isPaging = false;

	// options에 pageNum이나 pageSize가 포함되어 있는 경우, 페이지네이션을 통해 User 목록을 조회한다.
	if(_options && _options.pageNum && _options.pageSize) isPaging = true;

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
				return done(error);
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

/**
 * Channel 정보를 생성한다.
 * @name createChannel
 * @function
 * @param {object} input - JSON 형태의 data
 * @param {callback} done - Channel 정보 생성 후 수행할 callback function
 */
exports.createChannel = function(input, done) { // A, C, U, DT

  async.waterfall([

	  function(callback) {

	  	// 중복방지를 위해 id는 applicationId+^+channelId로 생성함
	    var channel = {
				_id: input.A+'^'+input.C,
	      A : input.A,
	      C : input.C,
	      US: {}
	    };
			if (input.DT) channel['DT'] = input.DT;

			// U 에 포함된 userId에 대한 validation 처리.
	    if (input.U) {

	      var query = { A: input.A };
	      var isExistedUsers = false;

	      // string type 인 경우 한명
	      if (typeof input.U == 'string') {
	        query['U'] = input.U;
	        isExistedUsers = true;

				// string type 인 아닌 경우
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

	      // 생성한 쿼리로 User가 있는지 조회한다.
	      if (isExistedUsers) {

	        User.find( query, { U: 1, DS: 1, _id: 0 }, function(err, doc) {

	          var result = [];

	          // 조회된 User list 를 사용하여 US array 를 생성한다.
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

	  	// 입력받은 channelId가 없는 경우, 자동으로 channelId를 생성한다.
	    if (!newChannel.C) {
	      newChannel.C = shortId.generate();
		  	newChannel._id =  newChannel.A+'^'+newChannel.C
		  	console.log("======== newChannel ",newChannel);
	      var _c = new Channel(newChannel);
	      _c.save(done);
	      callback(null, newChannel);

	    } else {

	    	// channelId가 있는면, Channel 정보를 생성 후 리턴한다.
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

	        } else {
	        	//이미 있는 경우, 존재한다는 메시지만 리턴한다.
	          return done('ERR-EXISTED');
	        }
	      });
	    }
	  }
	], function(er, result) {

  });
};

/**
 * User가 포함된 Channel list 를 조회한다.
 * @name listChannel
 * @function
 * @param {object} input - JSON 형태의 input data ( A, U )
 * @param {callback} done - Channel 정보 조회 후 수행할 callback function
 */
exports.listChannel = function(input, done) { // A, U
  var query = { A: input.A, 'US.U': input.U };
  Channel.find(query, function(err, channels) {
    if (err) return done(err);

    if (!channels) {
      done(null, null, {
        message: 'Channel is not found'
      });
    } else {
      done(null, channels);
    }
  });
};

/**
 * 특정 Channel 정보를 조회한다.
 * @name getChannel
 * @function
 * @param {object} input - JSON 형태의 input data ( A, U )
 * @param {callback} done - Channel 정보 조회 후 수행할 callback function
 */
exports.getChannel = function(input, done) { // A, C
  var query = { A: input.A, C: input.C };
  Channel.findOne(query).lean().exec(function(err, channel) {
    if (err) return done(err);

    if (!channel) {
      done(null, null, {
        message: 'Channel is not found'
      });
    } else {
      done(null, channel);
    }
  });
};

/**
 * 특정 Channel에 User 정보를 추가한다.
 * @name addChannelUser
 * @function
 * @param {object} input - JSON 형태의 input data ( A, C, U, DT )
 * @param {callback} done - User 추가 후 수행할 callback function
 */
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

	  // US 정보와 DT를 갱신한다.
	  function(users, callback) {
			var query  = { A: input.A, C: input.C };
			var update = { '$addToSet': { US: { $each : users } }, '$set': { DT: input.DT } };
			Channel.update(query, update, { "multi": true }, function(err, data) {
				if (err) return done(err);
				callback(null, users);
			});
	  }
	], function(er, result) {
		done(null, result);
  });
};

/**
 * 특정 Channel의 정보를 수정한다.
 * @name updateChannel
 * @function
 * @param {object} input - JSON 형태의 input data ( A, C )
 * @param {callback} done - User 추가 후 수행할 callback function
 */
exports.updateChannel = function(input, done) {
	var query  = {
		A: input.A,
		C: input.C
	};
	var update = input.Q;

	Channel.findOneAndUpdate(query, update, function(err, data) {
		if (err) {
			console.log(err);
			if (done) done(err);
		} else {

			if(!data){
				if (done){
					return done('ERR-NOTEXIST', data);
				}else{
					return;
				}
			}

			if (done) done(null, data);
		}
	});
};

/**
 * 특정 Channel에서 나간다.
 * @name exitChannel
 * @function
 * @param {object} input - JSON 형태의 input data ( A, C )
 * @param {callback} done - User 추가 후 수행할 callback function
 */
exports.exitChannel = function(input, done) { // A, C, U

	var query  = {
		A: input.A,
		C: input.C,
		'US.U': input.U
	};

	var update = {
		'$pull': { US: { U: input.U } }
	};

	// Channel User 목록에서 지운다.
	Channel.findOneAndUpdate(query, update, { "multi": true, "select": 'US' }, function(err, data) {
		if (err) {
			console.log(err);
			if (done) done(err);
		} else {

			if(!data){
				if (done){
					return done('ERR-NOTEXIST', data);
				}else{
					return;
				}
			}

			// Channel에 한명도 존재하지 않으면, Channel을 삭제한다.
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

/**
 * Message를 DB에 저장한다.
 * @name storeMessages
 * @function
 * @param {object} input - JSON 형태의 input data ( A, C, NM, DT, US, TS )
 * @param {callback} done - Message 저장 후 수행할 callback function
 */
exports.storeMessages = function(input, done) { // A, C, NM, DT, US, TS

	if (input.DT && typeof input.DT == 'object') {
		input.DT = JSON.stringify(input.DT);
	}

	// Message 객체를 만든다
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

/**
 * unread Message를 DB에서 조회한다.
 * @name unReadMessages
 * @function
 * @param {object} input - JSON 형태의 input data ( A, C, U, D )
 * @param {callback} done - Message 저장 후 수행할 callback function
 */
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

/**
 * Message를 DB에서 삭제한다.
 * @name removeUnReadMessages
 * @function
 * @param {object} input - JSON 형태의 input data ( A, C, U, D )
 * @param {callback} done - Message 삭제 후 수행할 callback function
 */
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

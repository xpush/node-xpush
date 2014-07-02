var User     = require('./user'),
		Channel  = require('./channel'),
    Message  = require('./message'),
    UnreadMessage  = require('./unreadMessage'),
    utils    = require('../server/utils'),
    shortId  = require('shortid'),
    async    = require('async'),
		_ = require('underscore');

// User

exports.registerUser = function (_app, _userId, _password, _deviceId, _notiId, _datas, done) {

	var query = {
		app : _app,
		userId : _userId
	};

  var data = {
		password    : _password,
		datas       : _datas,
		groups			: []
  };
	data['devices.'+_deviceId+'.notiId'] = _notiId;

	User.update( query, { '$set': data }, { upsert: true }, function(err) {
			if (err) {
				return done(err);
			}
			//var result = _.extend(query, data);
			if(done) done(null);

		});

};


exports.addDevice = function (_app, _userId, _deviceId, _notiId, done) {

	var query = {
		app : _app,
		userId : _userId
	};

	var data = {};
	data['devices.'+_deviceId+'.notiId'] = _notiId;

	User.update( query, { '$set': data }, { upsert: true }, function(err) {
			if (err) {
				return done(err);
			}
			//var result = _.extend(query, data);
			if(done) done(null);

		});

};

exports.updateUser = function(_app, _userId, _deviceId, _password, _notiId, _datas, done){

  retrieveUser(_app, _userId, _deviceId, function(err,user,msg){
    if(err){
      console.log("------ error");
      return done(err);
    }
    // User not found
    if(!err && !user){
      console.log("======= user not found");
      return done(msg.message);
    }

    if( user.password != _password ) {
      return done('wrong password');
    }

    user.notiId   = _notiId;
    user.datas    = _datas;

    user.save(function(err){
      if(err){
        return done(err);
      }
      done(null, user);
    });
  });
};

var retrieveUser = exports.retrieveUser = function (_app, _userId, _deviceId, done) {

	var query = {
		app : _app,
		userId : _userId
	};
	if(_deviceId){
		query['devices.'+_deviceId] = { '$exists': true } ;
	}

  User.findOne( query ).lean().exec(function (err, user) { //, function (err, user) {
      if (err) {
        return done(err);
      }

      if (!user) {
        return done(null, null, { message: 'User not found' });
      }
      return done(null, JSON.parse(JSON.stringify(user)));

    });
};

exports.updateUserToken = function (_app, _userId, _deviceId, _token, done) {

	var query = {
		app : _app,
		userId : _userId
	};
	query['devices.'+_deviceId] = { '$exists': true } ;

	var data = {};
	data['devices.'+_deviceId+'.token'] = _token;

  User.update( query, {'$set': data}, {upsert: false}, function(err) {
      if (err) {
        return done(err);
      }
      done(null, _token);
    });

};

exports.addGroupId = function (_app, _userId, _groupId, done) {
	var query = {
		app : _app,
		userId : _userId
	};

	var data = { '$push': { 'groups': _groupId } };

	User.update( query, data, {upsert: true}, function(err) {
			if (err) {
				return done(err);
			}
			done(null, _groupId);
		});
};

exports.removeGroupId = function (_app, _userId, _groupId, done) {
	var query = {
		app : _app,
		userId : _userId
	};

	var data = { '$pull': { 'groups': _groupId } };

	User.update( query, data, {upsert: false}, function(err) {
			if (err) {
				return done(err);
			}
			done(null, _groupId);
		});
};

exports.listGroup = function (_app, _groupId, done) {
	var query = {
		app : _app,
		groups: _groupId
	};

	User.find(
		query,
		{ userId: 1, datas: 1, _id:0 },
		function(err, users) {

			if (!users) {
				return done(null, null, { message: 'User not found' });
			}

			return done(null, users);

		});
};

exports.searchUser = function (_app, _keys, _values, done){

  var query = {app: _app};

  if(_keys){

    if(_keys.length != _values.length) return done('Search conditions is not valid');

    for(var i=0; i<_keys.length; i++) {
      query[_keys[i]] = _values[i];
    }

  }

  User.find(
    query,
    { userId: 1, devices: 1, datas: 1,  _id:0 },
    function(err, users) {

      if (!users) {
        return done(null, false, { message: 'User not found' });
      }

      return done(null, users);

    });

};


exports.createChannel = function (_app, _channel, _userIds, done) {

  async.waterfall([
    function(callback){

      var channel = {
        app: _app,
        channel: _channel,
        users: {}
      };

      if(_userIds){

        var query = {
          app: _app
        };
        var isExistedUsers = false;
        if(typeof _userIds == 'string'){
          query['userId'] = _userIds;
          isExistedUsers = true;
        }else{
          if(_userIds.length == 1){
            query['userId'] = _userIds;
            isExistedUsers = true;
          }else if(_userIds.length > 1){
            query['$or'] = [];
            for ( var i in _userIds ){
              query['$or'].push({userId: _userIds[i]});
            }
            isExistedUsers = true;
          }
        }

        if(isExistedUsers) {

          User.find(
            query,
            { userId: 1, devices: 1, _id:0 },
            function(err, doc) {

							var result = [];
							for(var i = 0; i<doc.length; i++) {
								var devs = doc[i].devices;
								var keys = Object.keys(devs);
								keys.forEach(function(key){
									var _t = {};
									_t['userId'] 		= doc[i].userId;
									_t['deviceId'] 	= key;
									_t['notiId'] 		= devs[key].notiId;

									result.push(_t);
								});
							}

              if(err) done(err);
              channel.users = result;

              callback(null, channel);

            });

        }else{

          callback(null, channel);
        }

      }else{
        callback(null, channel);
      }

    },
    function(newChannel, callback){

      if(!newChannel.channel){
        newChannel.channel = shortId.generate();
        var _c = new Channel(newChannel);
        _c.save(done);
        callback(null, newChannel);

      }else{

        Channel.findOne({app: _app, channel: _channel}, function(err, doc){
          if (err){
            return done(err);
          }

          if(!doc){
            var _c = new Channel(newChannel);
            _c.save(done);
            callback(null, newChannel);

          }else{
            return done(null, {message: 'The channel is existed.'});
          }

        });
      }
    }
  ], function (er, result) {

  });

};

exports.listChannel = function (_app, _userId, done) {

	var query = {
		app : _app,
		'users.userId': _userId
	};
  Channel.find( query, function (err, channels) {
    if (err){
      return done(err);
    }

    if(!channels){
      done(null, null, {message:'Channel is not found'});
    }else{
      done(null, channels);
    }
  });

};

exports.getChannel = function (_app, _channel, done) {

	var query = {
		app : _app,
		channel : _channel
	};

  Channel.findOne( query, function (err, channel) {
    if (err){
      return done(err);
    }

    if(!channel){
      done(null, null, {message:'Channel is not found'});
    }else{
      done(null, JSON.parse(JSON.stringify(channel)));
    }
  });

};

exports.addChannelUser = function (_app, _channel, _userIds, done) {


	async.waterfall([
		function(callback){

			var query = {
				app: _app
			};

			if(typeof _userIds == 'string'){
				query['userId'] = _userIds;
			}else{
				if(_userIds.length == 1){
					query['userId'] = _userIds;
				}else if(_userIds.length > 1){
					query['$or'] = [];
					for ( var i in _userIds ){
						query['$or'].push({userId: _userIds[i]});
					}
				}
			}

			User.find(
				query,
				{ userId: 1, devices: 1, _id:0 },
				function(err, doc) {

					var result = [];
					for(var i = 0; i<doc.length; i++) {
						var devs = doc[i].devices;
						var keys = Object.keys(devs);
						keys.forEach(function(key){
							var _t = {};
							_t['userId'] 		= doc[i].userId;
							_t['deviceId'] 	= key;
							_t['notiId'] 		= devs[key].notiId;

							result.push(_t);
						});
					}

					if(err) done(err);
					callback(null, result);

				});

		},
		function(users, callback){

			Channel.update(
				{ 'app'    :         _app,
					'channel':      _channel},
				{ '$pullAll'   : { 'users': users} },
				{ "multi"  : true },
				function (err, data){
					if (err) {
						return done(err);
					}else{
						callback(null, users);
					}
				});


		},
		function(users, callback){

			Channel.update(
				{ 'app'     : _app,
				  'channel' : _channel},
				{ '$pushAll': { 'users': users } },
				{ "multi"   : true },
				function (err, data){
					if (err) {
						return done(err);
					}else{
						done(null, users);
					}
				});
		}
	], function (er, result) {

	});


/*

  User.findOne(
    { app: _app, userId: _userId },
    { userId: 1, devices: 1, _id:0 },
    function(err, doc) {

      if(err) {
        return done(err);
      }

			var result = [];
			var devs = doc.devices;
			var keys = Object.keys(devs);
			keys.forEach(function(key){
				var _t = {};
				_t['userId'] 		= doc.userId;
				_t['deviceId'] 	= key;
				_t['notiId'] 		= devs[key].notiId;

				result.push(_t);
			});

			Channel.update(
				{ 'app'    :         _app,
				  'channel':      _channel},
				{ '$pull'   : { 'users': {'userId': _userId }} },
				{ "multi"  : true },
				function (err, data){
					if (err) {
						return done(err);
					}else{
						Channel.update(
							{ 'app':         _app,
							'channel':      _channel},
							{ '$pushAll': { 'users': result } },
							{ "multi" : true },
							function (err, data){
								if (err) {
									return done(err);
								}else{
									done(null, result);
								}
							});
					}
				});


    });
		*/

};

exports.exitChannel = function (_app, _channel, _userId, done) {

  Channel.update(
    { 'app':          _app,
      'channel':      _channel,
      'users.userId': _userId},
    { '$pull': { 'users': {'userId': _userId }} },
    { "multi" : true },
    function (err, data){
      if (err) {
        if(done) done(err);
      }else{
        if(done) done(null, data);
      }
    });

};

exports.storeMessage = function (_app, _channel, _userId, _deviceId, _data, done){

  if(typeof _data == 'object'){
    _data = JSON.stringify(_data);
  }

  var _m = new Message({
    app:      _app,
    channel:  _channel,
    userId:   _userId,
    deviceId: _deviceId,
    data:     _data
  });

  if(done){
    _m.save(done);
  }else{
    _m.save();
  }

};

exports.storeMessages = function (_app, _channel, _name, _data, _users, timestamp, /* _userId, _deviceId, */ done){

  if(typeof _data == 'object'){
    _data = JSON.stringify(_data);
  }
  _data.created = timestamp;
  var msg = new Message({
    data:     _data
  });

  msg.save(function(err, _message){

    var unreadMsgs = [];

    for(var i=0; i<_users.length; i++){
      var _unreadMsg = {
        app:       _app,
        channel:   _channel,
        userId:    _users[i].userId,
        deviceId:  _users[i].deviceId,
        name:      _name,
        message:   _message._id,
        created:   timestamp
      };
      unreadMsgs.push(_unreadMsg);
    }

    UnreadMessage.create(unreadMsgs, function (err) {

      if (err) {
        done(err);
      }else{
        done(null);
      }

      /*for (var i=1; i<arguments.length; ++i) {
          var _m = arguments[i];
          // ??
      }*/

    });
  });

};


exports.unReadMessages = function (_app, _channel, _userId, _deviceId, done){

  var queryCond = {
    'app': _app,
    'userId': _userId
  };

  if(_channel){
    queryCond['channel'] = _channel;
  }

  if(_deviceId){
    queryCond['deviceId'] = _deviceId;
  }

  UnreadMessage.find(
    queryCond,
    { '_id': 0, 'name':1,'message': 1}

  ).populate(
    'message'
  ).exec(function (err, messages) {

    if (err) {
      done(err);
    }else{
      done(null, messages);
    }

  });

  /*
  Message.find(
    { 'app': _app,
      'channel': _channel,
      'userId': _userId,
      'deviceId': _deviceId },
    { 'created': 1, 'data': 1, _id:0 },
    function(err, data) {

      if (err) {
        done(err);
      }else{
        done(null, data);
      }
    }); */
};

exports.removeUnReadMessages = function (_app, _channel, _userId, _deviceId, done){

  var queryCond = {
    'app': _app,
    'userId': _userId
  };

  if(_channel){
    queryCond['channel'] = _channel;
  }

  if(_deviceId){
    queryCond['deviceId'] = _deviceId;
  }

  UnreadMessage.remove(
    queryCond
  ).exec(function (err) {

    if (err) {
      done(err);
    }else{
      done(null, 'ok');
    }
  });
};

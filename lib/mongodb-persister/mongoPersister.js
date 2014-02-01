var User     = require('./user'),
		Channel  = require('./channel'),
    Message  = require('./message'),
    UnreadMessage  = require('./unreadMessage'),
    utils    = require('../server/utils'),
    shortId  = require('shortid'),
    async    = require('async');

// User

exports.registerUser = function (_app, _userId, _password, _deviceId, _notiId, _datas, done) {
  
  var user = new User({
    app         : _app,
    userId      : _userId,
    password    : _password,
    deviceId    : _deviceId,
    notiId      : _notiId,
    datas       : _datas
  });
  
  var query = { 
    app        : _app, 
    userId     : _userId, 
    deviceId   : _deviceId
  };
  
  User.findOne(query, function(err, doc){
    
    if (err) {
      return done(err);
    }
    if(!doc){
      user.save(done);
    }else{
      
      doc.notiId = _notiId;
      doc.datas  = _datas;
      doc.save(done);
    }
  });
  
};

exports.retrieveUser = function (_app, _userId, _deviceId, done) {
  
  User.findOne(
    {app: _app, userId: _userId, deviceId: _deviceId}, 
    function (err, user) {
      if (err) {
        return done(err);
      }
      
      if (!user) {
        return done(null, false, { message: 'User not found' });
      }
      
      return done(null, user);
      
    });
  
};

exports.updateUserToken = function (_app, _userId, _token, done) {
  
  User.update(
    {app:_app, userId:_userId}, 
    {$set: { token: _token }}, 
    {upsert: false}, 
    function(err) {
      if (err) {
        return done(err);
      }
      
      done(null, _token);
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
    { userId: 1, deviceId: 1, notiId: 1, datas: 1,  _id:0 },
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
          console.log(query);
          User.find(
            query, 
            { userId: 1, deviceId: 1, notiId: 1, _id:0 }, // sessionId: 1,   ?
            function(err, doc) {
              
              if(err) done(err);
              channel.users = doc;
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
  
  Channel.find(
    { 'app': _app,
     'users.userId': _userId },
    function (err, channels) {
      
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

  Channel.find(
    { 'app':     _app,
      'channel': _channel },
    function (err, channel) {
      
      if (err){
        return done(err);
      }
      
      if(!channel){
        done(null, null, {message:'Channel is not found'});
      }else{
        done(null, channel);
      }
    });
  
};



exports.addChannelUser = function (_app, _channel, _userId, done) {
  
  User.find(
    { app: _app, userId: _userId }, 
    { userId: 1, deviceId: 1, notiId: 1, _id:0 }, // sessionId: 1,   ?
    function(err, users) {
      
      if(err) {
        return done(err);
      }
      
      Channel.update(
        { 'app':         _app, 
         'channel':      _channel},
        { '$push': { 'users': users } },
        { "multi" : true },
        function (err, data){
          if (err) {
            return done(err);
          }else{
            done(null, users);
          }
        });
      
    });
  
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


exports.getUsersForNotification = function (_app, _channel, done) {
	
	Channel.find(
    { 'app': _app, 
			'channel': _channel /*, 
			'users.sessionId': null*/ }, 
		//{ 'users': 1, _id:0 },
    function(err, data) {
			
      if (err) {
        return done(err);
      }else{
				if(data && data[0]){
					done(null, data[0].users);	
				}else{
					done(null);
				}
        
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

exports.storeMessages = function (_app, _channel, _data, _users, /* _userId, _deviceId, */ done){

  if(typeof _data == 'object'){
    _data = JSON.stringify(_data);
  }
  
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
        message:   _message._id
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
 
  UnreadMessage.find(
    { 'app': _app, 
      'channel': _channel,
      'userId': _userId,
      'deviceId': _deviceId },
    { '_id': 0, 'message': 1}
    
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


/*
exports.updateUser = function (_app, _userId, _sessionId, _notiId, done){
  
  var u = {};
  
  if(_sessionId)  u.sessionId = _sessionId;
  if(_notiId)     u.notiId    = _notiId;
    
  User.update(
    { app:    _app, 
      userId: _userId }, 
    { $set:   u }, 
    { upsert: false }, 
    function(err) {
      
    if (err) return done(err);
    done(null, _sessionId);
      
  });
};

exports.cleanSessionId = function (_app, _userId, done){
  
  User.update(
    { app:    _app, 
      userId: _userId }, 
    { $set:   { sessionId: null } }, 
    { upsert: false }, 
    function(err) {
      
    if (err) return done(err);
    done(null, _userId);
      
  });
};

exports.createUserSessionId = function (_app, _userId, done) {
  var _sessionId = shortId.generate(); 
  User.update({app:_app, userId:_userId}, {$set: { sessionId: _sessionId }}, {upsert: false}, function(err) {
    if (err) {
      return done(err);
    }

    done(null, _sessionId);
  });
};



exports.removeUserSessionId = function (_app, _userId, _deviceType, done) {
   
  User.update({app:_app, userId:_userId, deviceType: _deviceType}, {$set: { sessionId: null }}, {upsert: false}, function(err) {
    if (err) {
      return done(err);
    }

    done(null);
  });
};

// Channel 
// - create / join / leave / exit


exports.joinChannel = function (_app, _channel, _userId, _socketId, done) {

  Channel.update(
    { 'app': _app, 
      'channel': _channel, 
      'users.userId': _userId},
    {  $set: {
              'users.$.socketId': _socketId}},
    { "multi" : true },
    
    function (err, affected ){
      
      if (err) {
        return done(err);
        
      }else{
        
        done(null, affected);
      }
    });

};

exports.offChannel = function (_app, _channel, _sessionId, done) {

  Channel.update(
    { 'app': _app, 
      'channel': _channel, 
      'users.sessionId': _sessionId},
    {  $set: { 'users.$.sessionId': null}},
    { "multi" : true },
    function (err, data){
      if (err) {
        if(done) done(err);
      }else{
        if(done) done(null, data);
      }
    });

};




exports.endAllChannel = function (_app, _userId, _deviceType, done) {
  
  Channel.update(
    { 'app':          _app, 
      'users.userId': _userId},
    { '$pull': { 'users': {'userId': _userId, 'deviceType': _deviceType }} },
    { "multi" : true },
    function (err, data){
      if (err) {
        return done(err);
      }else{
        done(null, data);
      }
    });

};



exports.getChannel = function (_app, _channel, done) {
  
  var query = { app     : _app,
                channel : _channel};


  Channel.findOne(query, function (err, channel) {

    if (err){
      return done(err);
    }

    if(!channel){
      done(null, null, {message:'Channel not found'});
    }else{
      done(null, channel);
    }
  });
          
};

<<<<<<< HEAD
exports.listChannel = function (_app, _userId, done) {

  Channel.find(
    { 'app': _app,
      'users.userId': _userId },
    function (err, channels) {

    if (err){
      return done(err);
    }

    if(!channels){
      done(null, null, {message:'Channel is not found'});
    }else{
      done(null, {result :channels} );
    }
  });
          
};
=======
>>>>>>> big-cleanup



exports.createMessage = function (_app, _channel, _senderObj, _receiverObj, _message, done) {

  if(typeof _message == 'object'){
    _message = JSON.stringify(_message);
  }
  
  var _m = new Message({
    app: _app,
    channel: _channel,
    sender: _senderObj,
    receiver: _receiverObj,
    message: _message
  });
  
  console.log(_m);

  _m.save(done);  
};

exports.getMessagesByUserId = function (_app, _channel, _receiverUserId, done) {
  
  Message.find({app: _app, channel: _channel, 'receiver.userId': _receiverUserId }, function (err, message) {
    if (err) {
      return done(err);
    }

    if (!message) {
      return done(null, false, { message: 'Message not found' });
    }

    return done(null, message);
  });
};

*/



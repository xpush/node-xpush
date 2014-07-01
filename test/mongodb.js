var database          = require('../lib/mongodb-persister/database'),
    mongoPersister    = require('../lib/mongodb-persister/mongoPersister'),
    serverUtils       = require('../lib/server/utils'),
    util              = require('util'),
    assert            = require("chai").assert,
    expect            = require("chai").expect;


describe("MongodbPersistor", function(){
  before(function(done){
    database.config('', 'xpush',
      function (err, message) {
        if(!err){
          console.info('  - Mongodb is connected');
          done();
        }else{
          process.exit(-1);
        }

      }
    );
  });

    describe("#registration()", function(){

      // registerUser = function (_app, _userId, _password, _deviceId, _notiId, _datas, done)
      it("Register User : yohan ", function(done){

        mongoPersister.registerUser(
          'stalk.io',                       // _app,
          'yohan',                          //_userId,
          serverUtils.encrypto('password'), //_password,
          'web',                            //_deviceId,
          '',                               //_notiId
          {
            email: 'yohany@gmail.com',
            gender: 'male',
            features: 'awesome',
            job: 'superman'
          },
          function (err) {
            assert.isNull(err, 'there was no error');
            done();
          });
      });

      it("Register User : james ", function(done){

        mongoPersister.registerUser(
          'stalk.io',                       // _app,
          'james',                          //_userId,
          serverUtils.encrypto('password'), //_password,
          'web',                            //_deviceId,
          '',                               //_notiId
          {
            email: 'james@gmail.com',
            gender: 'male',
            features: 'james dean ?',
            job: 'spiderman'
          },
          function (err) {
            assert.isNull(err, 'there was no error');
            done();
          });
      });

      it("Register User : Ally ", function(done){

        mongoPersister.registerUser(
          'stalk.io',                       // _app,
          'ally',                          //_userId,
          serverUtils.encrypto('password'), //_password,
          'web',                            //_deviceId,
          '',                               //_notiId
          {
            email: 'ally.kim@gmail.com',
            gender: 'female',
            features: 'awesome',
            job: 'spider'
          },
          function (err) {
            assert.isNull(err, 'there was no error');
            done();
          });
      });

      it("Add device to yohan ", function(done){

        mongoPersister.addDevice(
          'stalk.io',                       // _app,
          'yohan',
          '1235-6783-1871234-328271384-1233-4123413251234',                            //_deviceId,
          'AMSDFuwehfasdf-asdfEWFHSIDhgawe-fawehfxkajecawGawg-aaAA923rhnjkag48',
          function (err) {
            assert.isNull(err, 'there was no error');
            done();
          });
      });


      it("Add device to james ", function(done){

        mongoPersister.addDevice(
          'stalk.io',                       // _app,
          'james',
          '1235-6783-1871234-328271384-1233-4123413251234',                            //_deviceId,
          'AMSDFuwehfasdf-asdfEWFHSIDhgawe-fawehfxkajecawGawg-aaAA923rhnjkag48',
          function (err) {
            assert.isNull(err, 'there was no error');
            done();
          });
      });

      it("retrieve yohan's user information #1 ", function(done){
        mongoPersister.retrieveUser(
          'stalk.io',                       // _app,
          'yohan',
          '1235-6783-1871234-328271384-1233-4123413251234',
          function (err, user) {
            //console.log(user);
            assert.isNull(err, 'there was no error');
            assert.isNotNull(user, 'user is not existed');
            done();
          });
      });
      it("retrieve yohan's user information #2 ", function(done){
        mongoPersister.retrieveUser(
          'stalk.io',                       // _app,
          'yohan',
          'web',
          function (err, user) {
            //console.log(user);
            assert.isNull(err, 'there was no error');
            assert.isNotNull(user, 'user is not existed');
            done();
          });
      });
      it("retrieve ally's user information #1 ", function(done){
        mongoPersister.retrieveUser(
          'stalk.io',                       // _app,
          'ally',
          '1235-6783-1871234-328271384-1233-4123413251234',
          function (err, user, message) {
            assert.isNull(err, 'there was no error');
            assert.isNull(user, 'user is not existed');
            done();
          });
      });

      it("update yohan's token #1 ", function(done){
        mongoPersister.updateUserToken(
          'stalk.io',                       // _app,
          'yohan',
          '1235-6783-1871234-328271384-1233-4123413251234',
          'TOKEN_1234567890127462391520987',
          function (err, token) {
            //console.log(token);
            assert.isNull(err, 'there was no error');
            assert.isNotNull(token, 'token is not existed');
            done();
          });
      });


    });

    describe("#group()", function(){

      it("add group 'ally' to yohan", function(done){
        mongoPersister.addGroupId(
          'stalk.io',                       // _app,
          'yohan',
          'ally',
          function (err) {
            assert.isNull(err, 'there was no error');
            done();
          });
      });

      it("add group 'XXXX' to yohan", function(done){
        mongoPersister.addGroupId(
          'stalk.io',                       // _app,
          'yohan',
          'XXXX',
          function (err) {
            assert.isNull(err, 'there was no error');
            done();
          });
      });

      it("remove group 'XXXX' from yohan", function(done){
        mongoPersister.removeGroupId(
          'stalk.io',                       // _app,
          'yohan',
          'XXXX',
          function (err) {
            assert.isNull(err, 'there was no error');
            done();
          });
      });


      it(" group list by ally", function(done){
        mongoPersister.listGroup(
          'stalk.io',
          'ally',
          function (err, users) {
            assert.isNull(err, 'there was no error');
            //console.log(users);
            done();
          });
      });

    });


    describe("#channel()", function(){

      it(" createChannel", function(done){
        mongoPersister.createChannel(
          'stalk.io',
          'CH0000001',
          ['yohan', 'ally'],
          function (err, channel) {
            assert.isNull(err, 'there was no error');
            //console.log(channel);
            done();
          });
      });
/*
      it(" createChannel", function(done){
        mongoPersister.createChannel(
          'stalk.io',
          '',
          ['yohan', 'ally'],
          function (err, channel) {
            assert.isNull(err, 'there was no error');
            //console.log(channel);
            done();
          });
      });
*/
      it(" createChannel", function(done){
        mongoPersister.createChannel(
          'stalk.io',
          'CH01111112',
          ['yohan', 'ally'],
          function (err, channel) {
            assert.isNull(err, 'there was no error');
            //console.log(channel);
            done();
          });
      });






      it(" add a user to channel", function(done){
        mongoPersister.addChannelUser(
          'stalk.io',
          'CH01111112',
          'james',
          function (err, user) {
            assert.isNull(err, 'there was no error');
            console.log(user);
            //console.log(channels.length);
            done();
          });
      });


      it(" retrieve channel lists", function(done){
        mongoPersister.listChannel(
          'stalk.io',
          'yohan',
          function (err, channels) {
            assert.isNull(err, 'there was no error');
            //console.log(channels);
            //console.log(channels.length);
            done();
          });
      });


    });
});

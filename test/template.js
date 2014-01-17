var io     = require('socket.io-client');
    assert = require('assert');


describe('Suite of socket server tests', function() {
/*
  beforeEach(function(done){
    console.log('....START');
  });

  afterEach(function(done){
    console.log('....END');
  });
*/
  describe('Test 1', function(){
    it('Job 1-1', function(done){
console.log('ABCD1');
      setTimeout(function(){
        done();
      }, 1000);

    });
    it('Job 1-2', function(done){
      console.log('ABCD1-2');
      done();
    });
  });

  describe('Test 2', function(){
    it('Job 1-1', function(done){
console.log('ABCD2');
      done();
    });
  });

});

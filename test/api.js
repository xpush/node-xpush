var restify = require('restify'),
    async   = require('async');


var TEST_DATA = {};

var client_gateway = restify.createJsonClient( {
  url: 'http://gateway.server:8000',
  version: '*'		
});


async.waterfall([

  // app 생성 (flashmob 어플리케이션 생성)
  function(cb){

    var URL = '/app/create/flashmob'; console.log('** '+URL);
	  client_gateway.post( URL,
	    function(err, req, res, data) {
	    	if( err ){
	    		console.log( err );
	    	} else {
          console.log(data);
          TEST_DATA.appId1 = data.result.appId
	    		cb( null );
	    	}
	    }
	  );

  },

  // app 생성 (slideair 어플리케이션 생성)
  function(cb){

    var URL = '[URL] /app/create/slideair'; console.log('** '+URL);
	  client_gateway.post( URL,
	    function(err, req, res, data) {
	    	if( err ){
	    		console.log( err );
	    	} else {
          console.log(data);
          TEST_DATA.appId2 = data.result.appId
	    		cb( null );
	    	}
	    }
	  );

  },

  // app 단건조회(flashmob 어플리케이션 조회)
  function(cb){

    var URL = '[URL] /app/get/' + TEST_DATA.appId1; console.log('** '+URL);
	  client_gateway.get( URL,
	    function(err, req, res, data) {
	    	if( err ){
	    		console.log( err );
	    	} else {
          console.info(data);
	    		cb( null );
	    	}
	    }
	  );

  },

  // 모든 app 조회  
  function(cb){

    var URL = '[URL] /app/list'; console.log('** '+URL);
	  client_gateway.get( URL,
	    function(err, req, res, data) {
	    	if( err ){
	    		console.log( err );
	    	} else {
          console.info(data);
	    		cb( null );
	    	}
	    }
	  );

  },

  // flashbom 어플 삭제
  function(cb){

    var URL = '[URL] /app/remove/'+TEST_DATA.appId1; console.log('** '+URL);
	  client_gateway.post( URL,
	    function(err, req, res, data) {
	    	if( err ){
	    		console.log( err );
	    	} else {
          console.info(data);
	    		cb( null );
	    	}
	    }
	  );

  },

  // slideair 어플 삭제
  function(cb){

    var URL = '[URL] /app/remove/'+TEST_DATA.appId2; console.log('** '+URL);
	  client_gateway.post( URL,
	    function(err, req, res, data) {
	    	if( err ){
	    		console.log( err );
	    	} else {
          console.info(data);
	    		cb( null );
	    	}
	    }
	  );

  },

  function(cb){
    console.log('FIN');
  }

]);

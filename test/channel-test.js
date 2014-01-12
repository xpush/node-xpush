var restify = require('restify'),
   async   = require('async');


var APP_ID;
var client = restify.createJsonClient( {
  url: 'http://127.0.0.1:8081',
  version: '*'		
});

async.waterfall([

  // 1. create app
  function(cb){
  	console.log( '*** create app : ap01' );

	client.post(
	    '/app/app01',
	    function(err, req, res, data) {
	    	if( err ){
	    		console.log( err );
	    	} else {
			APP_ID = data.appId;
	    		cb( null );
	    	}
	    }
	);
  },

  // 2. create channel
  function(cb){
  	console.log( '*** create channel : ch01' );

	client.post(
	    '/channel/create/ch01',
	    { app: APP_ID },
		function(err, req, res, data) {
	    	if( err ){
	    		console.log( err );
	    	} else {
			console.log( data );
	    		cb( null );
	    	}
	    }
	);
  }
]);

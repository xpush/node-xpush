var http = require( 'http' );

exports.post = function( host, port, path, data, cb ){
	var dataObject = JSON.stringify(
	  data
	);

	var postheaders = {
	  'Content-Type' : 'application/json',
	  'Content-Length' : Buffer.byteLength(dataObject, 'utf8')
	};

	// the post options
	var optionspost = {
	  host : host,
	  port : port,
	  path : path,
	  method : 'POST',
	  headers : postheaders
	};

	// do the POST call
	var reqPost = http.request(optionspost, function(res) {
	  var result = "";
	  res.on('data', function(chunk) {
	    result += chunk;
	  });

	  res.on('end', function(){
	    cb( null, JSON.parse( result ) );
	  });
	});
	 
	// write the json data
	reqPost.write(dataObject);
	reqPost.end();
	reqPost.on('error', function(e) {
	  console.error(e);
	});
};

exports.get = function( host, port, path, cb ){

	// the post options
	var optionsget = {
	  host : host,
	  port : port,
	  path : path,
	  method : 'GET'
	};

	// do the GET call
	var reqGet = http.request(optionsget, function(res) {
	  var result = "";
	  res.on('data', function(chunk) {
	    result += chunk;
	  });

	  res.on('end', function(){
	    cb( null, JSON.parse( result ) );
	  });
	});

	reqGet.end();
	reqGet.on('error', function(e) {
	  console.error(e);
	});
};
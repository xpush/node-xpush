var http = require( 'http' ),
		fs = require( 'fs' ),
		path = require( 'path' ),
		mime = require('mime');

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

exports.postFile = function( host, port, path, data, cb ){

	// the post options
	var options = {
	  host : host,
	  port : port,
	  path : path,
	  method : 'POST'
	};

  options.headers = {
    'XP-A': data.appId,
    'XP-C': data.channel,
    'XP-U': JSON.stringify({
      U: data.userId,
      D: data.deviceId
    })
  };

  function getFormDataForPost(value) {
    function encodeFilePart(boundary,type,name,filename) {
      var return_part = "--" + boundary + "\r\n";
      return_part += "Content-Disposition: form-data; name=\"" + name + "\"; filename=\"" + filename + "\"\r\n";
      return_part += "Content-Type: " + type + "\r\n\r\n";
      return return_part;
    }
    var boundary = Math.random();
    var post_data = [];
   
    if (value) {
      post_data.push(new Buffer(encodeFilePart(boundary, value.type, value.keyname, value.valuename), 'ascii'));
 
      post_data.push(new Buffer(value.data, 'utf8'))
    }
    post_data.push(new Buffer("\r\n--" + boundary + "--"), 'ascii');
    var length = 0;
   
    for(var i = 0; i < post_data.length; i++) {
      length += post_data[i].length;
    }
    var params = {
      postdata : post_data,
      headers : {
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': length
      }
    };
    return params;
  }

  var fileUri = data.fileUri;
  var fileUris = fileUri.split( path.sep );
  var fileNm = fileUri.split( path.sep )[ fileUris.length-1];
  options.headers['XP-FU-org'] = fileNm;

  var result = '';

  var filecontents;

  fs.readFile(fileUri, function read(err, filecontents) {
    if (err) {
      throw err;
    }

    var type = mime.lookup(fileUri);
    var keyname = "";
    if( type.indexOf( "/" ) > 0 ){
      keyname = type.split("/")[0];
    }

    var fileValue = {type: type, keyname: keyname, valuename: fileNm, data: filecontents};
    var headerparams = getFormDataForPost(fileValue);
    var totalheaders = headerparams.headers;
    for (var key in totalheaders) options.headers[key] = totalheaders[key];

    var request = http.request( options, function(res) {

      res.setEncoding('utf8');
      res.on("data", function(chunk) {
        result = result + chunk;      
      });

      res.on("end", function() {
        cb(null, JSON.parse( result ) );
      });

    }).on('error', function(e) {
      debug("ajax error: " + e.message);
      cb(null, JSON.parse( result ) );
    });

    for (var i = 0; i < headerparams.postdata.length; i++) {
      request.write(headerparams.postdata[i]);
    }

    request.end();
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


exports.deleteFolderRecursive = function(path) {
	var self = this;
	var files = [];
	if( fs.existsSync(path) ) {
		files = fs.readdirSync(path);
		files.forEach(function(file,index){
			var curPath = path + "/" + file;
			if(fs.lstatSync(curPath).isDirectory()) { // recurse
				self.deleteFolderRecursive(curPath);
			} else { // delete file
				fs.unlinkSync(curPath);
			}
		});
		fs.rmdirSync(path);
	}
};
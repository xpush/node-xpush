var nodegcm = require('node-gcm');

// insert Google Server API Key here
var Gcm = exports.Gcm = function (api_key) {
  this.sender = new nodegcm.Sender(api_key); 
};

Gcm.prototype.send = function(gcmIds, json){
	var data = json;
	if( data.MG != undefined && data.message === undefined ){
		data.message = data.MG;
	}

	if( data.UO.NM != undefined && data.title === undefined ){
		data.title = data.UO.NM;
	}

  var message = new nodegcm.Message();
  message.addDataWithObject(data);
  this.sender.send(message, gcmIds, 4, function (err, result) {
    console.log(result);
  });
};

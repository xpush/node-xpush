var nodegcm = require('node-gcm');

// insert Google Server API Key here
var Gcm = exports.Gcm = function (api_key) {
  this.sender = new nodegcm.Sender(api_key); 
};

Gcm.prototype.send = function(gcmIds, json){
	var data = json;
  var message = new nodegcm.Message();
  message.addDataWithObject(data);
  this.sender.send(message, gcmIds, 4, function (err, result) {
    console.log(result);
  });
};

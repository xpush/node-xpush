var nodegcm = require('node-gcm');

// insert Google Server API Key here
var Gcm = exports.Gcm = function (api_key) {
  this.sender = new nodegcm.Sender(api_key); 
};

Gcm.prototype.send = function(gcmIds, data){
  var message = new nodegcm.Message();
  this.sender.send(message, gcmIds, 4, function (err, result) {
    console.log(result);
  });
};

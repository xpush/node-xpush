var nodegcm = require('node-gcm');

// insert Google Server API Key here
var Gcm = exports.Gcm = function (api_key) {
  this.sender = new nodegcm.Sender(api_key); 
};

Gcm.prototype.send = function(gcmIds, data){
  var message = new nodegcm.Message();
  message.addDataWithObject(data);
  /* possibe data manipulate
  message.addDataWithKeyValue('key0','value0');
  message.addDataWithObject({
    key1: 'value1',
    key2: 'value2'
  });
  message.addData('key3','value3');
  message.key4 = 'value4';
  */

  /**
   * Params: message-literal, registrationIds-array, No. of retries, callback-function
   **/
  this.sender.send(message, gcmIds, 4, function (err, result) {
    console.log(result);
  });


};

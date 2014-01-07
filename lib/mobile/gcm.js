var gcm = require('node-gcm');

var sender = new gcm.Sender('insert Google Server API Key here');
// Todo :  GCM Server API key in Config File


exports.gcm = function(gcmIds, data){
	var message = new gcm.Message(data);
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
	sender.send(message, gcmIds, 4, function (err, result) {
	    console.log(result);
	});


}
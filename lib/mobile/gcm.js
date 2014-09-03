var nodegcm = require('node-gcm');

/**
 * `node-gcm` module을 사용하여 gcm을 메시지를 보낸다.
 * @module Gcm
 * @param {string} api_key - Google Server API
 */
var Gcm = exports.Gcm = function (api_key) {
  this.sender = new nodegcm.Sender(api_key); 
};

/**
 * 파라미터로 전달 받은 gcmId array를 활용하여 Gcm message 를 보냄
 * @name send
 * @memberof Gcm
 * @param {array} gcmIds - 구글에 등록된 registration ID의 배열
 * @param {object} json - Gcm으로 보내기 위한 data
 * @function send
 */
Gcm.prototype.send = function(gcmIds, json){
	var data = json;
  var message = new nodegcm.Message();
  message.addDataWithObject(data);
  this.sender.send(message, gcmIds, 4, function (err, result) {
    console.log(result);
  });
};
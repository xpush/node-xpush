var Gcm = require('../lib/mobile/gcm').Gcm;
var argv     = require('optimist').argv;
var config = require( '../config.sample.json' );

Gcm = new Gcm( config.gcm_api_key );

// Add gcmId
var gcmIds = [];
gcmIds.push( argv.gcmId );

// Send Gcm
Gcm.send( gcmIds, "data" );

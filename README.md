# xpush
Realtime communication api server and node-module.

[![Build Status](https://travis-ci.org/xpush/node-xpush.png?branch=master)](https://travis-ci.org/xpush/node-xpush)

### xpush
'xpush is an realtime communication api server for quickly, easily adding scalable functionality to web and mobile apps.

It makes it easy to send real-time notifications to Android and iOS devices, and send messages to various messengers (via XMPP) and send real-time datas to Webpages (via websocket, wrapping socket.io).

'xpush' is consists of npush a api server and a gateway server.
Gateway server is for load balancing and managing many distributed api servers.

## Usage

### Preparation
  * zookeeper - http://zookeeper.apache.org
  * redis - http://redis.io

### Install

	$ npm install -g xpush
	
For developer, 
	$ git clone https://github.com/xpush/node-xpush.git
	$ cd node-xpush
	$ npm install
	
	Start Xpush Servers
	$ ./bin/xpush --port 8088 --config ./config.sample.json
	$ ./bin/xpush --gateway --port 8088 --config ./config.sample.json

### Start a gateway server

	$ xpush --gateway --port 8080 --config ./config.sample.json

### Start a API server

	$ xpush --port 8088 --config ./config.sample.json





 



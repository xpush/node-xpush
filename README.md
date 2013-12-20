# npush
Realtime communication api server and node-module.

[![Build Status](https://travis-ci.org/xpush/node-xpush.png?branch=master)](https://travis-ci.org/xpush/node-xpush)

### npush
'xpush is an realtime communication api server for quickly, easily adding scalable functionality to web and mobile apps.

It makes it easy to send real-time notifications to Android and iOS devices, and send messages to various messengers (via XMPP) and send real-time datas to Webpages (via websocket, wrapping socket.io).

'xpush' is consists of npush a api server and a gateway server.
Gateway server is for load balancing and managing many distributed api servers.

## Usage

### Prepare
  * zookeeper - http://zookeeper.apache.org
  * redis - http://redis.io

### Install

	$ npm install -g xpush

### Start a gateway server

	$ xpush --gateway --port 8080 --config ./config.sample.json

### Start a API server

	$ xpush --port 8088 --config ./config.sample.json





 



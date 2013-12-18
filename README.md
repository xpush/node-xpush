# npush
Realtime communication api server and node-module.

[![Build Status](https://travis-ci.org/n-push/npush.png?branch=master)](https://travis-ci.org/n-push/npush)

### npush
Npush is an realtime communication api server for quickly, easily adding scalable functionality to web and mobile apps.

Npush makes it easy to send real-time notifications to Android and iOS devices, and send messages to various messengers (via XMPP) and send real-time datas to Webpages (via websocket, wrapping socket.io).

Npush is consists of npush a api server and a gateway server.
Gateway server is for load balancing and managing distributed api servers. And api servers can easily scalable.

## Usage

### Prepare
  * zookeeper - http://zookeeper.apache.org
  * redis - http://redis.io

### Install

	$ npm install -g npush

### Start a gateway server

	$ npush-gateway --port 8080





 



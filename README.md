# xpush
x(extensional)push is the realtime communication api server and node-module.

- **The project is currently under development. Not yet available.**

[![Build Status](https://travis-ci.org/xpush/node-xpush.png?branch=master)](https://travis-ci.org/xpush/node-xpush)

## xpush
'xpush is an realtime communication api server for quickly, easily adding scalable functionality to web and mobile apps.

It makes it easy to send real-time notifications to Android and iOS devices, and send messages to various messengers (via XMPP) and send real-time datas to Webpages (via websocket, wrapping socket.io).

'xpush' is consists of a api server and a gateway server.
Gateway server is for load balancing and managing many distributed api servers.


## Getting Started  ( for dvelopers )
Currently under development. **This is only for contributors.**
#### 1. Install zookeeper and redis

Install and start zookeeper. (http://zookeeper.apache.org)

	$ wget http://apache.mirror.cdnetworks.com/zookeeper/zookeeper-3.4.5/zookeeper-3.4.5.tar.gz
	$ tar -xvzf ./zookeeper-3.4.5.tar.gz
	$ cd zookeeper-3.4.5/conf
	$ cp zoo_sample.cfg zoo.cfg
	$ cd ../bin
	$ ./zkServer.sh start
	
Install and start redis. (http://redis.io)

	$ wget http://download.redis.io/redis-stable.tar.gz
	$ tar xvzf redis-stable.tar.gz
	$ cd redis-stable
	$ make
	$ ./src/redis-server

#### 2. Clone xpush project

	$ git clone https://github.com/xpush/node-xpush.git
	$ cd node-xpush
	$ npm install

#### 3. Start xpush API Server

	$ ./bin/xpush --port 8081 --config ./config.sample.json

#### 4. Start xpush Gateway Server

	$ ./bin/xpush --port 8000 --config ./config.sample.json —gateway




## Documentation
_(Coming soon)_

## Examples
_(Coming soon)_

## Release History
_(Nothing yet)_


## License
xpush project may be freely distributed under the MIT license.

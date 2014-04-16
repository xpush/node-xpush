<p align="center">
  <img src="https://raw.githubusercontent.com/xpush/node-xpush/master/logo.png"/>
</p>

xpush
=======

**This project is currently under development.**

**XPUSH** (eXtensional PUSH) is a real-time communication server and a programmable library that supports websocket, GCM and APN. It is suitable for implementing components such as messengers and push system.

It makes it easy to send and receive real-time messages for web pages, android and iOS.

XPUSH is consists of a channel server and session servers to handle the load of millions of connections. Your applications can send and receive messages(or datas) via the dedicated Channel server. Before connecting with Channel server, Session server assigns Channel server to the clients. Session server is for load balancing and managing many distributed channel servers.

## Installation

Currently under development.

XPUSH is installed and managed via npm, the Node.js package manager.

#### Preparation to install

Before install and run XPUSH servers, you have to install zookeeper, redis and mongoDB.

- Install and start zookeeper. (http://zookeeper.apache.org/doc/trunk/zookeeperStarted.html)

- Install and start redis. 
(http://redis.io/download)

- Install and start mongoDB. (http://docs.mongodb.org/manual/installation/)

#### Install XPUSH

In order to get started, you'll want to install ```node-xpush``` globally. You may need to use sudo (for OSX, *nix, BSD etc) or run your command shell as Administrator (for Windows) to do this.

	npm install -g node-xpush

This will put the ```xpush``` command in your system path, allowing it to be run from any directory.

	$ xpush
	usage: xpush [options]

	Starts a xpush server using the specified command-line options

	options:
	  --port   PORT       (mandatory!) Port that the xpush server should run on
	  --config OUTFILE    (mandatory!) Location of the configuration file for the xpush server
	  --silent            Silence the log output from the xpush server
	  --session           start the session server for load-balancing xpush 	servers
	  --host              Hostname
	  -h, --help          You're staring at it

#### Configuration

In order to start XPUSH server, you have to create configuration file with zookeeper, redis, mongoDB addresses. Empty address is localhost and default ports.

	$ vi config.json
	{
	  "zookeeper": {},
	  "redis": {},
	  "mongodb": {}
	}


## Run XPUSH Servers

There are two distinct ways to use XPUSH: through the command line interface, or by requiring the xpush module in your own code.

#### -- Start XPUSH Server from the command line

##### Start XPUSH Session server

	$ xpush --port 8000 --config ./config.sample.json —session

##### Start XPUSH Channel server

	$ xpush --port 9990 --config ./config.sample.json 


#### --  Using XPUSH module from node.js
_(Coming soon)_


## Documentation
_(Coming soon)_

## Examples
_(Coming soon)_

## Release History
_(Nothing yet)_


## License
xpush project may be freely distributed under the MIT license.

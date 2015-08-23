<p align="center">
  <img src="https://raw.githubusercontent.com/xpush/node-xpush/master/logo.png" width="200px"/>
</p>

**Current release version is 0.0.23, You can download xpush module via NPM or this [link](https://github.com/xpush/node-xpush/releases). This master branch is currently under development, version 0.1.0.**

visit [XPUSH](http://xpush.github.io) (for current version 0.0.23)

xpush
=======

**XPUSH** (eXtensional PUSH) is a real-time communication server and a programmable library that supports websocket, GCM and APN. It is suitable for implementing components such as messengers and push system.


<div  align="center">
    <iframe class="embed-responsive-item" src="//www.youtube.com/embed/9r-4ZvWvRTg?rel=0" allowfullscreen></iframe>
</div>


Features
=======

You  can easily build real-time services with HTML5 Websocket and  socket.io, the module on node.js.

But, there are a lot of things to consider on building the real-time services. You need to consider various things such as distributed server configuration in consideration of the users who are rapidly increasing, network traffic processing of large capacity and scale-out strategy.

**XPUSH** is a server platform that provides such as real-time message communication, message storage, user and device management and Mobile Push Notification. Everyone will be able to install and use after you downloaded.
And, XPUSH is a service platform for developing a wide range of real-time services and applications over a single **XPUSH** server platform.

Without having to directly implement the real-time communication servers, After you install **XPUSH** platform, try adding a real-time data communication features of your service.

### 1. Real-time Web Communication Platform

" *We help you easily build real-time applications. XPUSH was designed for developers.* "

**XPUSH** consists of real-time communication servers that has been developed as a Web technology. You can build  a variety of real-time messaging applications such as your own messenger and chat services

Currently, **XPUSH** developers are provided Javascript libraries for developing Web services and JAVA libraries for developing JAVA applications and Android applications. We are continually developing additional libraries.

Real-time data communication, while maintaining the network connection between the Client and the Server, can transmit and receive data bidirectionally. If the connection to the server is lost, or even if some servers fails, it guarantees the service availability.

### 2. Works Everywhere

" *At the core of XPUSH is the HTML5 WebSocket protocol, but we also have fallback mechanisms so that XPUSH just works anywhere, anytime.* "

**XPUSH** was developed by node.js to implement high-performance servers. It uses Socket.IO, one of the modules for web-based real-time messaging. And we continue to update the modules to use the latest version.

Socket.IO enables real-time bidirectional event-based communication. It works on every platform, browser or device, focusing equally on reliability and speed.

### 3. Scalable Web Architecture

" *XPUSH was designed to work with commodity servers, an elastic virtualised environments saving you money and headaches. A scalable web application can handle growth – of users or work – without requiring changes to the source code and stoping existed servers* "

Real time server platform has to be designed to be able to handle a large amount of network traffic to a sharply rising splice. It has to run a large number of servers for load balancing, needs to designed to be non-disruptive expansion. **XPUSH** developers designed the **Scalable Web Architecture** for a long time, and continue to optimize the architecture design.

**XPUSH** manages the real-time status of the distributed servers through a **zookeeper** and use **Redis** to store connection information of the visitors and meta datas in the memory. And XPUSH stores various types of unstructured messages sent or received in **MongoDB**. 

**XPUSH** server platform run each in the Session server and Channel server.
Channel server is responsible to authenticate users, managing user and device information, and assigning distribution server for load balancing. Since relatively Channel servers are easy to increase the load on the network traffic, so that it can be added separately as an expansion only Channel server


## 1. Prepare

To use the XPUSH is, [nodejs](http://nodejs.org/), [zookeeper](http://zookeeper.apache.org/), [redis](http://redis.io/) is required .

The following is how to install 64bit linux. Please install to suit your environment.
If you have already been installed, please skip these preparation steps.

### nodejs
[nodejs installation](http://nodejs.org/download/) by referring to Download and unzip the nodejs.

	mkdir -p $HOME/xpush
	cd $HOME/xpush
	wget http://nodejs.org/dist/v0.12.7/node-v0.12.7-linux-x64.tar.gz
	tar zvf node-v0.12.7-linux-x64.tar.gz

Set the PATH environment variable so that you can use the node and npm to global.

	PATH=$HOME/xpush/node-v0.12.7-linux-x64/bin:$PATH

### zookeeper
Install and run zookeeper with reference [Zookeeper installation](http://zookeeper.apache.org/doc/trunk/zookeeperStarted.html).

The following is the code to install and run the zookeeper3.4.6.

	cd $HOME/xpush
	wget http://apache.mirror.cdnetworks.com/zookeeper/stable/zookeeper-3.4.6.tar.gz
	tar xvf zookeeper-3.4.6.tar.gz
<p/>
	cp zookeeper-3.4.6/conf/zoo_sample.cfg zookeeper-3.4.6/conf/zoo.cfg
	cd zookeeper-3.4.6/bin
	./zkServer.sh start


### redis
Install and run redis with reference [Redis installation](http://zookeeper.apache.org/doc/trunk/zookeeperStarted.html).

The follow is the code to install and run redis 3.0.3.

	cd $HOME/xpush
	wget http://download.redis.io/releases/redis-3.0.3.tar.gz
	tar xzf redis-3.0.3.tar.gz
	cd redis-3.0.3
	make
<p/>
	src/redis-server
	(daemon : $ nohup src/redis-server & )


## 2. Run your application with push module


### clone xpush repository

	git clone https://github.com/xpush/node-xpush.git

### run session server

	(작성 중. . . . .)


### run channel server

	(작성 중. . . . .)
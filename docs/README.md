# xpush API

Xpush API provides programmatic access to xpush functionality and content.

The API is [REST API](http://en.wikipedia.org/wiki/Representational_State_Transfer "RESTful")
Currently, return format for all endpoints is [JSON](http://json.org/ "JSON").

** The project is currently under development. Not yet available. **

***

## SDK (Libraries)

- **[JavaScript](https://github.com/500px/500px-js-sdk)**
- **Android**
- **iOS**
- **Node.js**
- **JAVA**
- **Python**
- more . . . 

# Endpoints

## App Resource _(on xpush-manager)_

#### **<code>POST</code> app/create/:app**
*  **app** _(required)_ — Application ID (unique name) to create.

#### **<code>GET</code> app/list**


## Server Resource _(on Gateway Server)_

#### **<code>GET</code> channel/:app/:channel**
*  **app** _(required)_ — Application ID.
*  **channel** _(required)_ — Channel ID.


## User Resources _(on API Server)_

#### **<code>POST</code> user/register**
*  **app** _(required)_ — Application ID..
*  **userId** _(required)_ — User ID (unique name) to create.
*  **deviceType** _(required)_ — Web / Android / IOS / App
*  **deviceId** _(required)_ — The unique id for the device.
*  **notiId** _(required)_ — The unique id for mobile notification.
*  **datas** — The additional datas for the user.

#### **<code>POST</code> user/login**
*  **app** _(required)_ — Application ID.
*  **userid** _(required)_ — User ID.

user Collection 에 session ID 를 생성하여 넣고, session ID 반환한다.

#### **<code>POST</code> user/logout**
*  **app** _(required)_ — Application ID.
*  **userid** _(required)_ — User ID.

user Collection 에서 session ID 를 제거한다.

#### **<code>GET</code> user/:app/:userId**
*  **app** _(required)_ — Application ID.
*  **userid** _(required)_ — User ID.


## Channel Resources _(on API Server)_

#### **<code>POST</code> channel/create/:channel**
*  **app** _(required)_ — Application ID.
*  **channel** — Channel ID to create.
*  HEADER:**sessionId** _(required)_ — User session ID.

channel 이 없다면 unique random 으로 생성한다.
 
생성된 channel id 가 반환된다.

#### **<code>POST</code> channel/join/:channel**
*  **app** _(required)_ — Application ID.
*  **channel** _(required)_ — Channel ID to join.
*  HEADER:**sessionId** _(required)_ — User session ID.

## Message Resources _(on API Server)_

#### **<code>POST</code> message**
*  **app** _(required)_ — Application ID.
*  **channel** — Channel ID to create.
*  **message** — any messages.
*  HEADER:**sessionId** _(required)_ — User session ID.




## Data Modeling

## Mongodb

### channel
- #### app | channel | users

		db.channel.insert(
		  {
			app: ‘slideair’,
			channel: ’CH0002’,
			users: [
			  {userId: ‘JYJung’, sessionId: ’123009283’},
			  {userId: ‘JohnKo’, sessionId: ’123009123’}
			]
		  }
		)

### message
- #### app | channel | senderId | receiverId | receiverDeviceId | message

		db.message.insert(
		  {
			app: ‘slideair’,
			channel: ’CH0002’,
			senderId: ’JYJung’,
			receiverId: ’JohnKo’,
			receiverDeviceId: ’AWkjfDFjeh089hmelwnvASFE3’,
			message: ’Hi there! Where are you ?’
		  }
		)


### user
- #### app | userId | sessionId | deviceType | deviceId | notiId | datas

		db.user.insert(
		  {
			app: ‘slideair’,
			userId: ’JYJung’,
			sessionId: ’123009283’,
			deviceType: ’Android’,
			deviceId: ’AWkjfDFjeh089hmelwnvASFE3’,
			notiID: ’TDJFPEKF9374FJDIVNEKFJDKSLAIWOPPQKVNEFK’,
			datas: {key1: ‘value1’, key2: ‘value2’}
		  }
		)


#### git command 
 [ git policy ](https://gist.github.com/notdol/8298927)

// # Application API

var constants   = require('../node-manager/constants'),
    shortId			= require('shortid');

var appAPI = exports.appAPI = function (nodeManager) {
	this.nodeManager = nodeManager;
	this.zkCli  = this.nodeManager.zkClient;
};


// ### /app/create/:appNm
//
// - *<code>URI</code> appNm* : application name
appAPI.prototype.create = function(req,res){

	var appNm = req.params.appNm;
  var appId = shortId.generate();

	var self = this;
  
  this.zkCli.getChildren(
    constants.BASE_ZNODE_PATH+constants.META_PATH,
    function (error, nodes, stats) {
      if (error) {
        console.log(error.stack);
        return;
      }
      var appInfo = appId+'^'+appNm;
      var nodePath = constants.META_PATH+constants.APP_PATH+'/'+appInfo;
      self.nodeManager._createZnode(nodePath, function(err){
				if(err){
          console.log(err);
					res.send({status: 'error', message: err});
				}else{
					res.send({status: 'ok', result: {'appId' : appId, 'appNm': appNm}});
				}
      });
    }
  );
};


// ### /app/remove/:appId
//
// - *<code>URI</code> appId* : application ID 
appAPI.prototype.remove = function(req,res ){
	var appId = req.params.appId;
  var self = this;
  var appNode = constants.BASE_ZNODE_PATH+constants.META_PATH+constants.APP_PATH;
  this.zkCli.getChildren(
    appNode,
    function (error, nodes, stats) {
      if (error) {
        console.log(error.stack);
        return;
      }

      for(var i = 0 ;i < nodes.length ; i ++){
        var item = nodes[i];
        if(item.indexOf(appId)==0){ // @ TODO !!! 
          try {
            self.zkCli.remove(appNode+'/'+item, -1, function (err) {
            });
          }catch(err){
            console.log(err);
          }
          res.send({status: 'ok'});
          return;
        }
      }
      res.send({status: 'error', message: 'not existed'});
    }
  );
};


// ### /app/list
//
appAPI.prototype.list = function(req,res){

  var self = this;
  var appNode = constants.BASE_ZNODE_PATH+constants.META_PATH+constants.APP_PATH;
  self.zkCli.getChildren(	
    appNode,
    function (error, nodes, stats) {
      if (error) {
        console.log(error);
        res.send({status: 'error', message: error});
        return;
      }

      var apps = [];
      nodes.forEach(function(item){
        var _appId = item.split('^')[0];
        var _appNm = item.split('^')[1];
        apps.push({appId: _appId, appNm: _appNm});
      });

      res.send({status: 'ok', result: apps});
    });
};


// ### /app/:appId
//
// - *<code>URI</code> appId* : application ID
appAPI.prototype.retrieve = function(req,res){
	var appId = req.params.appId;
  var self = this;
  var appNode = constants.BASE_ZNODE_PATH+constants.META_PATH+constants.APP_PATH;
  self.zkCli.getChildren(	
    appNode,
    function (error, nodes, stats) {

      if (error) {
        console.log(error.stack);
        res.send({status: 'error', message: error});
        return;
      }

			for(var i = 0 ;i < nodes.length; i ++){
				var app = nodes[i];
				if(app.indexOf(appId) == 0){
				res.send({status: 'ok', result: {appId: app.split('^')[0], appNm: app.split('^')[1]}}); 
          return;
				}
			}

			res.send({status: 'ok', message: 'not existed'});

    });

};

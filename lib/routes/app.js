// # Application API

var constants   = require('../node-manager/constants'),
    shortId		  = require('shortid');

var appAPI = function(nodeManager){
	this.nodeManager = nodeManager;
	this.zkCli  = this.nodeManager.zkClient;
}


// ### /app/create/:appNm
//
// - *<code>URI</code> appNm* : application name
appAPI.prototype.create = function(req,res){
	var appNm = req.params.appNm;
	var self = this;
  var appId = shortId.generate();
  this.zkCli.getChildren(
    constants.BASE_ZNODE_PATH+constants.META_PATH,
    function (error, nodes, stats) {
      if (error) {
        console.log(error.stack);
        return;
      }
      var appInfo = appId+'^'+appNm;
      var nodePath = constants.META_PATH+constants.APP_PATH+'/'+appInfo
      self.nodeManager._createZnode(nodePath, function(err){
      	if(err){
      		res.end(err);
      	}else{
      		res.end(JSON.stringify({appId : appId,appNm: appNm}));
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
  self.zkCli.getChildren(
    appNode,
    function (error, nodes, stats) {
      if (error) {
        console.log(error.stack);
        return;
      }

      for(var i = 0 ;i < nodes.length ; i ++){
        var item = nodes[i];
        if(item.indexOf(appId)==0){
          self.zkCli.remove(appNode+'/'+item, -1, function(err){
            if(err){
              console.log("remove node Error : "+ err);
            }
            res.end('success');
          });
          break; 
        };
      };
      console.log(nodes);
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
        console.log(error.stack);
        res.end(error);
        return;
      }
      var apps = [];
      nodes.forEach(function(item){
        var appId = item.split('^')[0];
        var appNm = item.split('^')[1];
        apps.push({appId: appId, appNm: appNm});
      })
      res.end(JSON.stringify(apps));
    });
}


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
        res.end(error);
        return;
      }
	    for(var i = 0 ;i < nodes.length; i ++){
	      var app = nodes[i];
	      if(app.indexOf(appId) == 0){
	        res.end(JSON.stringify({appId: app.split('^')[0], appNm: app.split('^')[1]})); break;
	      }
	    }
	    res.end('There is no AppId : '+appId);
    });

}
exports.appAPI = appAPI;

var nodeManager = require('../node-manager/node-manager');


exports.addApp = function(req, res){
	var appNm = req.params.appNm;

	nodeManager(appNm,function(err,appId){
		res.end(JSON.stringify({appId : appId}));
	});

};

exports.getApps = function(res,res){
	nodeManager(function(err,apps){
		res.end( JSON.stringify(apps) ) ;
	})
}

exports.getApp = function(req, res){
	var appId = req.params.app;


};

exports.delApp = function(req, res){
	var appId = req.params.appId;
	nodeManager(function(err){
		if(err){
			res.end(err);
		}else{
			res.end('success');
		}
	});
}

exports.modApp = function(req, res){
	// maybe modify Application info
	var appId = req.params.app;

}
exports.addUser = function(req, res){
	var appId = req.body.appId;
	var userId = req.body.userId;
	var deviceType = req.body.devType;
	var deviceId = req.body.devId;
	var notiId = req.body.notiId;
	//...
};

exports.getUser = function(req, res){
	var appId = req.body.appId;
	var userId = req.body.userId;

	// return userId devList(devId, devType)
	
};

exports.delUser = function(req, res){
	var appId = req.body.appId;
	var userId = req.body.userId;

}

exports.modUser = function(req, res){
	var appId = req.body.appId;
	var userId = req.body.userId;
	var deviceType = req.body.devType;
	var deviceId = req.body.devId;
	var notiId = req.body.notiId;
	//...
	
}
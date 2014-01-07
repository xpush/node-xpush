exports.addCh = function(req, res){
	var appId = req.param.appId;
	var userList = req.params.userList; //userId List
	var chId = req.param.chId; 


};

exports.getCh = function(req, res){
	var appId = req.param.appId;
	var chId = req.param.chId; 

	// return userList
};

exports.delCh = function(req, res){
	var appId = req.param.appId;
	var chId = req.param.chId; 

	// force emit data ( exit channel )
}

exports.joinCh = function(req, res){
	var appId = req.param.appId;
	var userList = req.params.userList; //userId List
	var chId = req.param.chId; 
	
	
}

exports.exitCh = function(req, res){
	var appId = req.param.appId;
	var userList = req.params.userList; //userId List
	var chId = req.param.chId; 

}
/*jshint -W117 */
/*jshint -W098 */

var ServerStatus = {
	OFFLINE: 1,
	NEWBOARD: 2,
	INITBOARD: 4,
	SYNC: 8,
	ONLINE: 16
};

function Server(hash, ready) {
	this.status = ServerStatus.OFFLINE;
	this.since = 0;
	this.code = 0;
	this.clientid = 0;
	if (hash) {
		this.hash = hash.slice(1);
		this.initBoard();
	} else {
		this.newBoard(this.initBoard);
	}
}

//Ask server for new board
Server.prototype.newBoard = function (callback) {
	this.status = ServerStatus.NEWBOARD;
	$.post("upload", {"action": "new"}, function (board) {
		this.hash = board.hash;
		this.clientmask = (board.clientid << 8);
		this.clientid = 0;
		if (callback) {
			callback(hash);	
		}
	}, "json");
};

//Ask server for board, given hash
Server.prototype.initBoard = function (callback) {
	this.status = ServerStatus.INITBOARD;
	$.post("upload", {"action": "init","hash": this.hash}, function (board) {
		this.clientmask = board.clientid << 8;
		if (callback) {
			callback(hash);			
		}
	}, "json");
};

Server.prototype.isReady = function () {
	return (this.status == ServerStatus.ONLINE) || (this.status == ServerStatus.SYNC);
};
Server.prototype.post = function (action, updata, callback,fallback,readymask) {
	readymask = typeof readystate !== 'undefined' ? readystate : (ServerStatus.SYNC | ServerStatus.ONLINE);
	if (readymask & this.status) {
		var defaults = {
			hash:this.hash,
			since:this.since,
			"action":action
		};
		$.extend(defaults, updata);
		$.post("upload", defaults, function(downdata) {
			this.since = downdata.since;
			if(callback) {
				callback(downdata.data);
			}
		},"json");
	} else {
		if(fallback) {
			fallback();
		} else {
			console.log("Failed readymask");
			console.log("> " + action);
		}
	}
};
Server.prototype.uploadLine = function (line, callback) {
	this.uploadLines([line],callback);
};
Server.prototype.uploadLines = function (lines, callback) {
	for (var i=0;i<lines.length;i++) {
		this.code = (this.code + 1) % 256;
		lines[i].code = this.clientmask + this.code;
	}
	this.post("lines",{linedata:JSON.stringify(lines)},function(ids){
		for(var i=0;i<ids.length;i++) {
			lines[i].id = ids[i];
		}
		if (callback) {
			callback(ids);
		}
	});
};
Server.prototype.clearBoard = function (callback) {
	this.post("clear",{},function(id){
		if(callback) {
			callback(id);			
		}
	});
};
Server.prototype.undo = function (line,callback) {
	this.post("undo",{code:line.code},function(){
		if (callback) {
			callback();
		}
	});
};
Server.prototype.getLines = function () {
	this.post("getlines",{},function(lines){
		if (callback) {
			callback(lines);
		}
	});
};
/*jshint -W117 */
/*jshint -W098 */

//Requires hook.js, flowmgmt.js timeout.js, jquery-me.2.2.js

//SERVER MUST BE INITIALIZED AFTER THE FLOWMGMT OBJECT HAS BEEN INITIALIZED!!!
var ServerStatus = {
	OFFLINE: 1,
	NEWBOARD: 2,
	INITBOARD: 4,
	ONLINE: 8,
	ERROR: 16
};

var svr = {
	continueOnError: true,
	status: ServerStatus.OFFLINE,
	since: 0,
	code: 0,
	clientid: 0,
	online: new Hook(),
	add: new Hook(),
	undo: new Hook(),
	clear: new Hook(),
	error: new Hook(),
	lastError: "",
	statusHook: new Hook(),
	statusUpdate: function(newStatus) {
		switch(typeof newStatus) {
			case "number":
				svr.status = newStatus;
				svr.statusHook();
				break;
			case "function":
				svr.statusHook(newStatus);
				break;
			default:
				svr.statusHook();
		}
	},
	allFlows: [],
	initialize: function(hash) {
		if (hash) {
			svr.hash = hash.slice(1);
			svr.initBoard();
		} else {
			svr.newBoard();
		}
		svr.add(flowMgmt.add);
		svr.undo(flowMgmt.undo);
		svr.clear(flowMgmt.clear);
		flowActions.add(svr.uploadFlow);
		flowActions.undo(svr.uploadUndo);
		flowActions.redo(function() {
			svr.uploadFlow(flowMgmt.getLastRedo());
		});
		flowActions.clear(svr.uploadClear);
		svr.error(function(msg) {
			svr.lastError = msg;
			svr.statusUpdate(ServerStatus.ERROR);
		});
	},
	//Ask server for new board
	newBoard: function () {
		svr.statusUpdate(ServerStatus.NEWBOARD);
		svr.status = 
		$.post("upload", {"action": "new"}, function (board) {
			svr.bringOnline(board.data.hash,board.data.clientid);
		}, "json");
	},
	//Ask server for board, given hash
	initBoard: function () {
		svr.statusUpdate(ServerStatus.INITBOARD);
		$.post("upload", {"action": "init","hash": svr.hash}, function (board) {
			svr.bringOnline(board.data.hash,board.data.clientid);
		}, "json");
	},
	bringOnline: function(hash,clientid) {
		svr.hash = hash;
		svr.clientid = clientid;
		svr.ticker = setInterval(svr.getLines,1000);
		svr.statusUpdate(ServerStatus.ONLINE);
		svr.online();
	},
	isReady: function(readymask) {
		readymask = typeof readymask !== 'undefined' ? readymask : ServerStatus.ONLINE;
		if(readymask & svr.status) return true;
		if(svr.continueOnError && (svr.status == ServerStatus.ERROR)) return true;
		return false;
	},
	post: function (action, updata, callback,fallback,readymask) {
		if (svr.isReady(readymask)) {
			var defaults = {
				hash:svr.hash,
				client:svr.clientid,
				since:svr.since,
				"action":action
			};
			$.extend(defaults, updata);
			$.post("upload", defaults, function(downdata) {
				svr.since = Math.max(downdata.since,svr.since);
				if(callback) {
					callback(downdata.data);
				}
			},"json").fail(svr.httpFail);
		} else {
			if(fallback) {
				fallback();
			} else {
				svr.error("Failed readymask on: " + action);
			}
		}
	},
	httpFail: function(jqXHR,txt,err){
		svr.error("HTTP Failure: " + txt + ", " + err + ", " + jqXHR.responseText);
	},
	uploadFlow: function (f) {
		svr.uploadFlows([f]);
	},
	uploadFlows: function (fs) {
		var currFlows = [];
		for (var i=0;i<fs.length;i++) {
			if(!svr.search(fs[i])){
				svr.code = (svr.code + 1) % 65536;
				svr.allFlows.push({client:svr.clientid,code:svr.code,flow:fs[i]});
				currFlows.push({code:svr.code,flow:Flow.serialize(fs[i])});
			}
		}
		svr.post("lines",{linedata:JSON.stringify(currFlows)});
	},
	uploadClear: function () {
		svr.post("clear",{});
	},
	uploadUndo: function (f) {
		var flow = typeof f == "undefined" ? f = flowMgmt.getLastUndo() : f;
		var src = svr.remove(flow);
		svr.post("undo",{client:src.client,code:src.code});
	},
	getLines: function () {
		var newFlow;
		var line;
		svr.post("getlines",{},function(lines){
			for(var idx in lines) {
				line = lines[idx];
				line.code = num(line.code);
				line.client = num(line.client);
				if(line.type == "flow") {
					if(!svr.search(line.client,line.code)){
						newFlow = Flow.deserialize(JSON.parse(line.data));
						svr.allFlows.push({client:line.client,code:line.code,flow:newFlow});
						svr.add(newFlow);
					}
				} else if(line.type == "undo") {
					var src = svr.remove(line.client,line.code);
					if(src) {
						svr.undo(src.flow);
					}
				} else if(line.type == "clear") {
					svr.allFlows = [];
					svr.clear();
				}
			}
		});
	},
	search: function (flowclient,code) {
		var i;
		if(typeof code == "number") {
			//flowclient is a client
			for(i=svr.allFlows.length-1;i>=0;i--) {
				if(svr.allFlows[i].code == code && svr.allFlows[i].client == flowclient) {
					return svr.allFlows[i];
				}
			}
		} else {
			//flowclient is an actual flow
			for(i=svr.allFlows.length-1;i>=0;i--) {
				if(svr.allFlows[i].flow == flowclient) {
					return svr.allFlows[i];
				}
			}
		}
		return false;
	},
	remove: function (flowclient,code) {
		var i;
		if(typeof code == "number") {
			//flowclient is a client
			for(i=svr.allFlows.length-1;i>=0;i--) {
				if(svr.allFlows[i].code == code && svr.allFlows[i].client == flowclient) {
					return svr.allFlows.splice(i,1)[0];
				}
			}
		} else {
			//flowclient is an actual flow
			for(i=svr.allFlows.length-1;i>=0;i--) {
				if(svr.allFlows[i].flow == flowclient) {
					return svr.allFlows.splice(i,1)[0];
				}
			}
		}
		return false;
	}
};

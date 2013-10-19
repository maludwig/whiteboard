/*jshint -W117 */
/*jshint -W098 */

function Server(hash,ready) {
	this.since = 0;
	this.code = Math.floor(Math.random()*32760);
	if(hash) {
		this.hash = hash.slice(1);
		this.setup();
	} else {
		this.newBoard(this.setup);
	}
}
Server.prototype.setup = function() {
	/*
	this.listener = function() {
		
	};
	this.timeout = new Timeout();
	*/
	alert("setup");
};
Server.prototype.newBoard = function(callback) {
	$.post("upload", {"action":"board"}, function(hash) {
		this.hash = hash;
		if(callback) {
			callback(hash);			
		}
	});
};
Server.prototype.uploadLine = function (line, callback) {
	if(this.hash) {
		this.code = (this.code + 1) % 32760;
		var obj = {
			action:"line",
			hash:this.hash,
			linedata:JSON.stringify(line)
		};
		$.post("upload", obj, function(id) {
			line.id = id;
			this.since = Math.max(this.since,id);
			if(callback) {
				callback(id);			
			}
		});
	}
};
Server.prototype.uploadLines = function (lines, callback) {
	if(this.hash) {
		for(var i=0;i<lines.length;i++) {
			this.code = (this.code + 1) % 32760;
			lines[i].code = this.code;
		}
		var obj = {
			action:"lines",
			hash:this.hash,
			linedata:JSON.stringify(lines)
		};
		$.post("upload", obj, function(ids) {
			for(var i=0;i<ids.length;i++) {
				lines[i].id = ids[i];
				this.since = Math.max(this.since,ids[i]);
			}
			if(callback) {
				callback(ids);
			}
		});
	}
};
Server.prototype.clearBoard = function (callback) {
	if(this.hash) {
		var obj = {
			action:"clear",
			hash:this.hash
		};
		$.post("upload", obj, function(id) {
			this.since = Math.max(this.since,id);
			if(callback) {
				callback(id);			
			}
		});
	}
};
Server.prototype.undo = function (line) {
	if(this.hash) {
		var obj = {
			action:"undo",
			hash:this.hash,
			code:line.code
		};
		$.post("upload", obj, function() {
			if(callback) {
				callback();
			}
		});
	}
};
Server.prototype.getLines = function (since) {
	if(this.hash) {
		var obj = {
			action:"getlines",
			hash:this.hash,
			"since":id
		};
		$.post("upload", obj, function(lines) {
			if(callback) {
				callback(lines);			
			}
		});
	}
};
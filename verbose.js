
		var vlog = function (msg) {
			$("#log").prepend("<div>" + msg + "</div>");
		};

		$(function(){
			log = vlog;
			svr.online(function(){
				log("svr online");
			});
			svr.add(function(){
				log("svr add");
			});
			svr.undo(function(){
				log("svr undo");
			});
			svr.clear(function(){
				log("svr clear");
			});
			svr.error(function(msg){
				log("svr error: " + msg);
			});
			svr.statusUpdate(function() {
				log("svr status: " + svr.status);
			});
			
			flowActions.add(function(){
				log("fa add");
			});
			flowActions.undo(function(){
				log("fa undo");
			});
			flowActions.redo(function(){
				log("fa redo");
			});
			flowActions.clear(function(){
				log("fa clear");
			});
			
		});
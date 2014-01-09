/*jshint -W117 */
/*jshint -W098 */

var pretty;
var shorthash;
var lastLineID = 0;
var pretties = [];
var listenTimeout; 
var mDown = false;
var xhr;

function listen() {
	minilog("listened");
	var o = {action:"getlines",hash:shorthash,since:lastLineID};
	xhr = $.get("upload",o,function(data) {
		if(typeof listenTimeout === "undefined" || listenTimeout.cleared) {
			drawLines(data);
			minilog("listen");
			listenTimeout = Timeout(listen,200);
		}
	},"json");
}

function processInput(data) {
	thispretty.id = data.id;
	pctx.fillText("id: " + data.id,thispretty.pts[0].x,thispretty.pts[0].y);
	drawLines(data);
	if(listenTimeout.cleared) {
		listenTimeout.reset();
	}
}

function stopListening() {
	if(listenTimeout) {
		listenTimeout.clear();
	}
	if(xhr) {
		xhr.abort();
	}
}

function drawLines(data) {
	for(var i=0;i<data.jsons.length;i++) {
		if (data.jsons[i].type == "clear") {
			clearDrawing();
		} else {
			pretties.push(new Pretty(JSON.parse(data.jsons[i])));
		}
	}
	lastLineID = Math.max(data.id,lastLineID);
}

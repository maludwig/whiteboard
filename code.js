/*jshint -W117 */
/*jshint -W098 */

var pretty;
var shorthash;
var lastLineID = 0;
var pretties = [];
var listenTimeout; 
var mDown = false;
var xhr;

function start(x,y) {
	pretty = new Pretty();
	pretty.addPoint(new Point(x,y));
}
function move(x,y) {
	pretty.addPoint(new Point(x,y));
}
function end(x,y) {
	stopListening();
	pretty.addPoint(new Point(x,y));
	pretty.endLine();
	pretties.push(pretty);
	var thispretty = pretty;
	if(shorthash) {
		var o = {action:"line",hash:shorthash,linedata:JSON.stringify(pretty),since:lastLineID};
		$.post("upload",o,function(data) {
			thispretty.id = data.id;
			pctx.fillText("id: " + data.id,thispretty.pts[0].x,thispretty.pts[0].y);
			drawLines(data);
			if(listenTimeout) {
				listenTimeout.reset();
			}
		},"json");
	}
	undoMark = -1;
	$("#undo").removeClass("inactive");
	$("#redo").addClass("inactive");
}

function log(msg) {
	msg = ('<p>' + msg + '</p>').replace(/\n/g,"<br />");
	//$("#log").prepend(msg);
}

function minilog(msg) {
	msg = ('<p>' + msg + '</p>').replace(/\n/g,"<br />");
	$("#log").prepend(msg);
}

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

<!DOCTYPE HTML>
<html>
<head>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
	<meta name="viewport" content="user-scalable=no, width=device-width, initial-scale=1, maximum-scale=1">
	<title>Test Whiteboard</title>
	<link href="style.css" rel="stylesheet" type="text/css" />
	<link href="//netdna.bootstrapcdn.com/font-awesome/3.2.1/css/font-awesome.css" rel="stylesheet" type='text/css'>
	<link href='http://fonts.googleapis.com/css?family=Julius+Sans+One' rel='stylesheet' type='text/css'>
	<link href='http://fonts.googleapis.com/css?family=Varela' rel='stylesheet' type='text/css'>
	<script type="text/javascript" src="js/excanvas.js"></script>
	<script src="//code.jquery.com/jquery-1.9.1.js"></script>
	<script src="//code.jquery.com/ui/1.10.3/jquery-ui.js"></script>
	<script type="text/javascript" src="js/jquery-me.2.2.js"></script>
	<script type="text/javascript" src="js/color.js"></script>
	<script type="text/javascript" src="js/hook.js"></script>
	<script type="text/javascript" src="js/touch.js"></script>
	<script type="text/javascript" src="js/linearalgebra-1.2.js"></script>
	<script type="text/javascript" src="js/jquery-center.1.2.js"></script>
	<script type="text/javascript" src="menu.js"></script>
	<script type="text/javascript" src="surface.js"></script>
	<script type="text/javascript" src="flow.js"></script>
	<script type="text/javascript" src="flowmgmt.js"></script>
	<script type="text/javascript" src="server.js"></script>
	<style>
	</style>
	<script>
		var vlog = function (msg) {
			$("#log").prepend("<div>" + msg + "</div>");
		};
		var log = function() {};
		$(function(){
			log = vlog;
			$("#sidebar h3:first").click(function() {
				log = vlog;
				$(this).css("color","green");
			});
			flowMgmt.initialize();
			flowActions.initialize();
			menu.initialize();
			svr.online(function() {
				svr.uploadFlows(flows);
				location.hash = svr.hash;
			});
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
			
			if(location.hash) {
				svr.initialize(location.hash);
			}
			
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
	</script>
</head>

<body>
	<div id="sidebar" class="open">
		<div id="sideexpand"><i class="icon-angle-right"></i><i class="icon-angle-left"></i></div>
		<h3>Whiteboard</h3>
		<hr />
		<div id="palettes">
			<div id="palexpand"><i class="icon-angle-right"></i><i class="icon-angle-left"></i></div>
		</div>
		<hr />
		<div id="sizes">
			<div id="sizeexpand"><i class="icon-angle-right"></i><i class="icon-angle-left"></i></div>
		</div>
		<hr />
		<div id="tools">
			<div id="pen" class="active"><i class="icon-pencil"></i><p>Pen</p></div>
			<div id="highlighter"><i class="icon-sun"></i><p>Highlighter</p></div>
			<div id="eraser"><i class="icon-eraser"></i><p>Eraser</p></div>
		</div>
		<hr />
		<div id="bgs">
			<img src="img/bg0icon.png" data-bg="0">
			<img src="img/bg1icon.png" data-bg="1">
			<img src="img/bg2icon.png" data-bg="2">
			<img src="img/bg3icon.png" data-bg="3" class="active">
			<img src="img/bg4icon.png" data-bg="4">
		</div>
		<hr />
		<div id="functions">
				<div id="clear"><i class="icon-star-empty"></i><p>Clear</p></div>
				<div id="share"><i class="icon-cloud"></i><p>Share</p></div>
				<div id="save"><i class="icon-save"></i><p>Save</p></div>
				<div id="undo" class="inactive"><i class="icon-mail-reply"></i><p>Undo</p></div>
				<div id="redo" class="inactive"><i class="icon-mail-forward"></i><p>Redo</p></div>
		</div>
		<hr />
		<div id="minis"></div>
	</div>
	<div id="log"></div>
	<div id="overlay"></div>
	<div id="lines"></div>
	<canvas id="historic"></canvas>
	<canvas id="modern"></canvas>
	<canvas id="scratch"></canvas>
	<div id="popup">
		<h3 id="title"></h3>
		<div id="message"></div>
		<button id="ok">OK</button>
	</div>
</body>
</html>
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
	<script type="text/javascript" src="menu.js"></script>
	<script type="text/javascript" src="surface.js"></script>
	<script type="text/javascript" src="flow.js"></script>
	<script type="text/javascript" src="flowmgmt.js"></script>
	<script type="text/javascript" src="server.js"></script>
	<style>
	</style>
	<script>
		var log;
		$(function(){
			flowMgmt.initialize();
			flowActions.initialize();
			menu.initialize();
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
			
			svr.initialize("#37");
			
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
			
//			svr.undo(function(f){
//				
//				//alert("newflow");
//				f.p = [];
//				if(f.s == modern) {
//					flowMgmt.redrawModern();
//				} else {
//					flowMgmt.redrawHistoric();
//				}
//			});
//			svr.clear(function(f){
//				//alert("newflow");
//				flowMgmt.clear();
//			});
		});
		function log(msg) {
			$("#log").prepend("<div>" + msg + "</div>");
		}
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
			<div id="pen" class="active"><i class="icon-pencil"></i></div>
			<div id="highlighter"><i class="icon-sun"></i></div>
			<div id="eraser"><i class="icon-eraser"></i></div>
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
			<div class="funcline">
				<div id="clear">&#59191;<p>Clear</p></div>
				<div id="share">&#59196;<p>Share</p></div>
				<div id="save">&#128190;<p>Save</p></div>
			</div>
			<div class="funcline">
				<div id="undo" class="inactive">&#59154;<p>Undo</p></div>
				<div id="redo" class="inactive">&#10150;<p>Redo</p></div>
				<div id="dorp">&#10150;<p>ECS</p></div>
			</div>
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
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
	<script type="text/javascript" src="js/jquery-me.2.1.js"></script>
	<script type="text/javascript" src="js/color.js"></script>
	<script type="text/javascript" src="js/hook.js"></script>
	<script type="text/javascript" src="js/touch.js"></script>
	<script type="text/javascript" src="js/linearalgebra-1.2.js"></script>
	<script type="text/javascript" src="menu.js"></script>
	<script type="text/javascript" src="surface.js"></script>
	<script type="text/javascript" src="flow.js"></script>
	<script type="text/javascript" src="undo.js"></script>
	<style>
	</style>
	<script>
		$(function(){
			hiddensurface = new Surface({drawing:false});
			scratch = new Surface({canvas:"#scratch",strokeWidth:80,color:"#1e77b9"});
			modern = new Surface({canvas:"#modern",strokeWidth:20,color:"#C42169"});
			historic = new Surface({canvas:"#historic",strokeWidth:20,color:"#1b3df5"});
			$("#overlay").touchStart(start);
			$("#overlay").touchMove(move);
			$("#overlay").touchEnd(end);
			scratchFlow = newFlow();
			$(window).keyup(function(e){
				if(e.which==90){
					undo();
				} else if(e.which==89) {
					redo();
				}
			});
			menu.initialize();
		});
		function log(msg) {
			$("#log").append("<div>" + msg + "</div>");
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
			<h3>0</h3>
			<h3>1</h3>
			<h3>2</h3>
			<h3 class="active">3</h3>
			<h3>4</h3>
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
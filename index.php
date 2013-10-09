<!DOCTYPE HTML>
<html>
<head>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
	<meta name="viewport" content="user-scalable=no, width=device-width, initial-scale=1, maximum-scale=1">
	<title>Whiteboard</title>
	<link rel="stylesheet" type="text/css" href="style.css" />
	<link href="//netdna.bootstrapcdn.com/font-awesome/3.2.1/css/font-awesome.css" rel="stylesheet">
	<link href='http://fonts.googleapis.com/css?family=Julius+Sans+One' rel='stylesheet' type='text/css'>
	<script type="text/javascript" src="js/excanvas.js"></script>
	<script src="//code.jquery.com/jquery-1.9.1.js"></script>
	<script src="//code.jquery.com/ui/1.10.3/jquery-ui.js"></script>
	<script type="text/javascript" src="js/linearalgebra-1.0.js"></script>
	<script type="text/javascript" src="js/drawing-1.0.js"></script>
	<script type="text/javascript" src="js/pretty-1.0.js"></script>
	<script type="text/javascript" src="js/jquery.hammer.min.js"></script>
	<script type="text/javascript" src="js/jquery-center.1.2.js"></script>
	<script type="text/javascript" src="js/modernizr.custom.74125.js"></script>
	<script>
		var undoPretties;
		var undoMark = -1;
		$(function() {
			$(window).resize(function() {
				//alert("res");
				resize($(window).width(), $(window).height());
			});
			$("#undo").click(function() {
				minilog("undo");
				var tempDrawColor = drawColor;
				var tempWidth = lineWidth();
				var tempDrawMode = drawMode;
				if(undoMark == -1) {
					undoPretties = pretties;
					undoMark = undoPretties.length;
				}
				if(undoMark == 0) {
					return;
				}
				clearDrawing();
				undoMark--;
				for(var i=0;i<undoMark;i++) {
					pretties.push(new Pretty(undoPretties[i]));
				}
				if(undoMark == 0) {
					$(this).addClass("inactive");
				}
				setColor(tempDrawColor);
				lineWidth(tempWidth);
				drawWith(tempDrawMode);
				$("#redo").removeClass("inactive");
				
				if(shorthash) {
					stopListening();
					var o = {action:"clear",hash:shorthash};
					$.post("upload",o,function(data) {
						lastLineID = data.id;
						var ld = [];
						for(var i=0;i<pretties.length;i++) {
							ld.push(JSON.stringify(pretties[i]));
						}
						var ls = {action:"lines",hash:shorthash,linedata:JSON.stringify(ld)};
						$.post("upload",ls,function(data){
							lastLineID = data.id;
							listen();
						},"json");
					},"json");
				}
			});
			$("#redo").click(function() {
				minilog("redo");
				if(undoMark == undoPretties.length) {
					return;
				}
				if(undoMark != -1) {
					pretty = new Pretty(undoPretties[undoMark]);
					pretties.push(pretty);
					undoMark++;
					stopListening();
					if(shorthash) {
						var o = {action:"line",hash:shorthash,linedata:JSON.stringify(pretty),since:lastLineID};
						$.post("upload",o,function(data) {
							lastLineID = data.id;
							listen();
						},"json");
					}
					if(undoMark == undoPretties.length) {
						$(this).addClass("inactive");
					}
					$("#undo").removeClass("inactive");
				}
			});
			$("#dorp").click(function(){
				stopListening("bitch");
			});
		});
	</script>
	<script type="text/javascript" src="code.js"></script>
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
	<div id="overlay"></div>
	<canvas id="hwb"></canvas>
	<canvas id="pwb"></canvas>
	<div id="popup">
		<h3 id="title"></h3>
		<div id="message"></div>
		<button id="ok">OK</button>
	</div>
	<div id="log"></div>
</body>
</html>


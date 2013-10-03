<!DOCTYPE HTML>
<html>
<head>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
	<title>Whiteboard</title>
	<link rel="stylesheet" type="text/css" href="style.css" />
	<script type="text/javascript" src="js/excanvas.js"></script>
	<script type="text/javascript" src="js/jquery-1.8.3.min.js"></script>
	<script type="text/javascript" src="js/linearalgebra-1.0.js"></script>
	<script type="text/javascript" src="js/drawing-1.0.js"></script>
	<script type="text/javascript">
		var pts = [];
		var lastx;
		var lasty;
		var mousebtns = {left: false, right: false, mid: false};
		var skip10 = 0;
		var pretty;
		function log(msg) {
			msg = ('<p>' + msg + '</p>').replace(/\n/g,"<br />");
			//$("#footer").append(msg);
		}
		$(window).load(function(){
			initCtx('#whiteboard');
			drawGrid();
			$("#overlay").mousedown(function(e){
				if(e.which == 1) {
					mousebtns.left = true;
				} else if (e.which == 2) {
					mousebtns.mid = true;
				} else if (e.which == 3) {
					mousebtns.right = true;
				}
				clearDrawing();
				pretty = new Pretty();
			});
			$("#overlay").mouseup(function(e){
				if(e.which == 1) {
					mousebtns.left = false;
				} else if (e.which == 2) {
					mousebtns.mid = false;
				} else if (e.which == 3) {
					mousebtns.right = false;
				}
				pretty.endLine();
			});
			$("#overlay").mousemove(function(e){
				if(!mousebtns.left) return;
				var x = e.pageX - $("#whiteboard").offset().left;
				var y = e.pageY - $("#whiteboard").offset().top;
				//x = x - (x % 30) + 15;
				//y = y - (y % 30) + 15;
				if(x == lastx && y == lasty) return;
				//skip10++;
				//if(skip10 < 20) return;
				//skip10 = 0;
				lastx = x;
				lasty = y;
				var p = new Point(x,y);
				pretty.addPoint(p);
			});
		});
	</script>
</head>

<body>
	<div id="header">
	</div>
	<div id="overlay"></div>
	<canvas id="whiteboard"></canvas>
	<div id="footer">
	</div>
</body>
</html>


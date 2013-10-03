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
			});
			$("#overlay").mouseup(function(e){
				if(e.which == 1) {
					mousebtns.left = false;
				} else if (e.which == 2) {
					mousebtns.mid = false;
				} else if (e.which == 3) {
					mousebtns.right = false;
				}
				if(pts.length > 2) {
					prettyLine(pts);
				}
				pts = [];
			});
			$("#overlay").mousemove(function(e){
				if(!mousebtns.left) return;
				var x = e.pageX - $("#whiteboard").offset().left;
				var y = e.pageY - $("#whiteboard").offset().top;
				x = x - (x % 30) + 15;
				y = y - (y % 30) + 15;
				if(x == lastx && y == lasty) return;
				skip10++;
				if(skip10 < 20) return;
				skip10 = 0;
				lastx = x;
				lasty = y;
				var p = new Point(x,y);
				pts.push(p);
				draw(p);
			});
		});
		
		/*
		function curve2() {
			var a = points[points.length-3];
			var b = points[points.length-2];
			var c = points[points.length-1];
			var ab = subPt(a,b);
			var cb = subPt(c,b);
			var len = mag(a,b);
			var d = addPt(c,mulPt(subPt(mulPt(ab,dot(ab,cb)/(len*len)),cb),2));
			drawDot(d.x,d.y);
			var tri = PPP(a,d,b);
			quadLine(tri);
		}
		
		function curve1() {
			var nextpt = points[points.length-1];
			var thispt = points[points.length-2];
			var prevpt = points[points.length-3];
			var tri = PPP(prevpt,thispt,nextpt);
			var len = mag(prevpt,thispt);
			var halfpt = {"x":(nextpt.x + thispt.x)/2,"y":(nextpt.y + thispt.y)/2};
			var rad = Math.acos((nextpt.x - thispt.x)/len) + (Math.PI/2);
			drawTri([prevpt,thispt,nextpt]);
			drawDot(halfpt.x,halfpt.y);
			drawText(((180 - tri.degb) / 180),20,20);
			halfpt.x += Math.cos(rad) * (len * ((180 - tri.degb) / 180));
			halfpt.y += Math.sin(rad) * (len * ((180 - tri.degb) / 180));
			drawDot(halfpt.x,halfpt.y);
			var tri2 = PPP(thispt,halfpt,nextpt);
			quadLine(tri2);
		}
		
		function quadLine(tri) {
			var wb = $('#whiteboard')[0];
			if (wb.getContext){
				var ctx = wb.getContext('2d');
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.moveTo(tri.a.x,tri.a.y);
				ctx.quadraticCurveTo(tri.b.x,tri.b.y,tri.c.x,tri.c.y);
				ctx.stroke();
			} else {
				alert('You need Safari or Firefox 1.5+ to see this demo.');
			}
		}
		*/
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


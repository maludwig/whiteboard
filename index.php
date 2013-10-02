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
		function log(msg) {
			msg = ('<p>' + msg + '</p>').replace(/\n/g,"<br />");
			$("#footer").append(msg);
		}
		$(window).load(function(){
			initCtx('#whiteboard');
			drawGrid();
			$("#overlay").mousedown(function(e){
				var x = e.pageX - $("#whiteboard").offset().left;
				var y = e.pageY - $("#whiteboard").offset().top;
				var p = new Point(x,y);
				pts.push(p);
				draw(p)
				if(pts.length % 4 == 0) {
					var p1 = pts[pts.length-4];
					var p2 = pts[pts.length-3];
					var p3 = pts[pts.length-2];
					var p4 = pts[pts.length-1];
					var v13 = new Vector(p1,p3);
					var v24 = new Vector(p2,p4);
					var ln1 = new Line(p2,v13);
					var ln2 = new Line(p3,v24);
					draw(ln1);
					draw(ln2);
					draw(ln1.intersect(ln2));
					//draw(new Line(new Point(100,100),p.x-pts[pts.length-2].x,p.y-pts[pts.length-2].y));
				}
			});
			return;
			var ln = new Line(new Point(450,650),0,12);
			var ln2 = new Line(new Point(550,450),0.01,-1);
			draw(ln);
			draw(ln2);
			draw(ln2.intersect(ln));
			var m = new Matrix([[1,2],[3,4]]);
			var m2 = new Matrix([[1,2],[3,4]]);
			log(m);
			log(m.col(0));
			log(m.col(1));
			log(m.col(2));
			
			log(m.row(1));
			log(m.mul(m2));
			
			var m3 = new Matrix([[1,0,-2],[0,3,-1]]);
			var m4 = new Matrix([[0,3],[-2,-1],[0,4]]);
			
			log(m3);
			log(m4);
			log(m3.mul(m4));
			log(m3.mul(5));
			log(m4.mul(5));
			$("#overlay").mousemove(function(e){
				var x = e.pageX - $("#whiteboard").offset().left;
				var y = e.pageY - $("#whiteboard").offset().top;
				var pt = new Point(x,y);
				var ln = new Line(Point.ORIGIN,1,1);
				var ln2 = new Line(new Point(450,450),1,-1);
				draw(pt);
				draw(ln.reflect(pt));
				draw(ln2.reflect(pt));
				draw(ln.reflect(ln2.reflect(pt)));
				draw(ln);
				draw(ln2);
			});
			
			var mdown = false;
			var lastpt;
			var icount = 0;
			var points = [];
			var pt1 = new Point(2,0);
			var pt2 = new Point(1,1);
			//alert(v12 instanceof Point);
			//alert(v12 instanceof Vector);
			log(new Vector(pt1));
			log(new Vector(pt1,pt2));
			var v1 = new Vector(2,3);
			log(v1);
			log(v1.add(v1));
			log(v1.sub(v1));
			log(v1.dot(new Vector(-2,3)));
			log(v1.mul(0.5));
			log(v1.mag());
			log(v1.magsq());
			var ln = new Line(pt2,0,1);
			log(ln);
			log(pt1 + " r " + ln.reflect(pt1));
			log(pt2 + " r " + ln.reflect(pt2));
			$("#overlay").mousemove(function(e){
				var x = e.pageX - $("#whiteboard").offset().left;
				var y = e.pageY - $("#whiteboard").offset().top;
				var pt = new Point(x,y);
				var ln = new Line(Point.ORIGIN,1,1);
				drawDot(pt);
				drawDot(ln.reflect(pt));
			});
		});
		
		function drawDot(x,y) {
			ctx.lineWidth = 1;
			ctx.beginPath();
			if(x instanceof Point) {
				ctx.arc(x.x,x.y,10,0,2*Math.PI);
				log("DrawDot: [" + x.x + "," + x.y + "]");
			} else {
				ctx.arc(x,y,10,0,2*Math.PI);
				log("DrawDot: [" + x + "," + y + "]");
			}
			ctx.stroke();
			ctx.fill();
		}
		
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
		
		function drawText(msg,x,y) {
			var canvas = $('#whiteboard')[0];
			if (canvas.getContext){
				var ctx = canvas.getContext('2d');
				ctx.font="16px Arial";
				ctx.fillText(msg,x,y);
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


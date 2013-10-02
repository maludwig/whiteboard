<!DOCTYPE HTML>
<html>
<head>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
	<title>The title</title>
	<link rel="stylesheet" type="text/css" href="style.css" />
	<script type="text/javascript" src="js/excanvas.js"></script>
	<script type="text/javascript" src="js/jquery-1.8.3.min.js"></script>
	<script type="text/javascript" src="js/linearalgebra-1.0.js"></script>
	<script type="text/javascript">
		var mdown = false;
		var lastpt;
		var icount = 0;
		var points = [];
		$(window).load(function() {
			$("#whiteboard").attr({
				width: 900,
				height: 900
			});
			$("#overlay").mousedown(function(){
				$("#footer").append("Down");
				mdown = true;
				
			});
			$("#overlay").mouseup(function(e){
				var x = e.pageX - $("#whiteboard").offset().left;
				var y = e.pageY - $("#whiteboard").offset().top;
				$("#footer").append("Up");
				mdown = false;
				lastpt = undefined;
				//alert(JSON.stringify(PPP({x:0,y:0},{x:1,y:0},{x:1,y:1})))
				points.push({"x":x,"y":y});
				if(points.length >= 3) {
					curve2();
				}
				drawDot(x,y);
				drawText("blah",x + 30,y);
			});
			$("#overlay").mousemove(function(e){
				if(mdown) {
					icount++;
					var x = e.pageX - $("#whiteboard").offset().left;
					var y = e.pageY - $("#whiteboard").offset().top;
					//drawLine(x,y);
				}
				$("#footer").html(icount);
			});
		});
		
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
		
		function divPt(pt,d) {
			return mulPt(pt,1/d);
		}
		
		function mulPt(pt,m) {
			return {"x":pt.x*m,"y":pt.y*m};
		}
		
		function addPt(pt1,pt2) {
			return {"x":pt1.x+pt2.x,"y":pt1.y+pt2.y};
		}
		
		function subPt(pt1,pt2) {
			return {"x":pt1.x-pt2.x,"y":pt1.y-pt2.y};
		}
		
		function dot(pt1,pt2) {
			return (pt1.x*pt2.x) + (pt1.y*pt2.y);
		}
		
		function mag(pt1,pt2) {
			var len = (pt1.x - pt2.x) * (pt1.x - pt2.x);
			len += (pt1.y - pt2.y) * (pt1.y - pt2.y);
			return Math.sqrt(len);
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
		
		function drawTri(p) {
			var wb = $('#whiteboard')[0];
			if (wb.getContext){
				var ctx = wb.getContext('2d');
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.moveTo(p[0].x,p[0].y);
				ctx.lineTo(p[1].x,p[1].y);
				ctx.lineTo(p[2].x,p[2].y);
				ctx.lineTo(p[0].x,p[0].y);
				ctx.stroke();
			} else {
				alert('You need Safari or Firefox 1.5+ to see this demo.');
			}
		}
		
		
		function drawLine(x, y) {
			if(lastpt) {
				var wb = $('#whiteboard')[0];
				if (wb.getContext){
					var ctx = wb.getContext('2d');
					ctx.lineWidth = 1;
					for (i=0;i<10;i++){
						ctx.beginPath();
						ctx.moveTo(lastpt.x,lastpt.y);
						ctx.lineTo(x,y);
						ctx.stroke();
					}
				} else {
					alert('You need Safari or Firefox 1.5+ to see this demo.');
				}
			}
			lastpt = {
				"x":x,
				"y":y
			};
		}
		
		function drawDot(x,y) {
			var wb = $('#whiteboard')[0];
			if (wb.getContext){
				var ctx = wb.getContext('2d');
				ctx.lineWidth = 1;
				for (i=0;i<10;i++){
					ctx.beginPath();
					ctx.arc(x,y,10,0,2*Math.PI);
					ctx.stroke();
					ctx.fill();
				}
			} else {
				alert('You need Safari or Firefox 1.5+ to see this demo.');
			}
			
		}
		
		function PPP(a,b,c) {
			var abx = a.x - b.x, acx = a.x - c.x, bcx = b.x - c.x;
			var aby = a.y - b.y, acy = a.y - c.y, bcy = b.y - c.y;
			var r = {};
			r.a = a;
			r.b = b;
			r.c = c;
			r.lena = Math.sqrt((bcx * bcx) + (bcy * bcy));
			r.lenb = Math.sqrt((acx * acx) + (acy * acy));
			r.lenc = Math.sqrt((abx * abx) + (aby * aby));
			r.rada = Math.acos(((r.lenb * r.lenb) + (r.lenc * r.lenc) - (r.lena * r.lena))/(2 * r.lenb * r.lenc));
			r.radb = Math.acos(((r.lena * r.lena) + (r.lenc * r.lenc) - (r.lenb * r.lenb))/(2 * r.lena * r.lenc));
			r.radc = (Math.PI) - (r.rada + r.radb);
			r.dega = r.rada * (180 / Math.PI);
			r.degb = r.radb * (180 / Math.PI);
			r.degc = r.radc * (180 / Math.PI);
			return r;
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


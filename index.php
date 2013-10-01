<!DOCTYPE HTML>
<html>
<head>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
	<title>The title</title>
	<link rel="stylesheet" type="text/css" href="style.css" />
	<script type="text/javascript" src="js/excanvas.js"></script>
	<script type="text/javascript" src="js/jquery-1.8.3.min.js"></script>
	<script type="text/javascript">
		var mdown = false;
		var lastpt;
		var icount = 0;
		var points = [];
		$(window).load(function() {
			$("#whiteboard").attr({
				width: 600,
				height: 600
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
				if(points.length == 3) {
					drawTri(points);
					var tri = PPP(points[0],points[1],points[2]);
					drawText(Math.round(tri.dega),points[0].x,points[0].y - 20);
					drawText(Math.round(tri.degb),points[1].x,points[1].y - 20);
					drawText(Math.round(tri.degc),points[2].x,points[2].y - 20);
					var avgx = (points[0].x + points[1].x + points[2].x) / 3;
					var avgy = (points[0].y + points[1].y + points[2].y) / 3;
					drawText((180 - tri.dega) / 180, avgx,avgy);
					quadLine(tri);
					var len = (points[0].x - points[1].x) * (points[0].x - points[1].x);
					len += (points[0].y - points[1].y) * (points[0].y - points[1].y);
					len = Math.sqrt(len);
					var halfpt = {"x":(points[0].x + points[1].x)/2,"y":(points[0].y + points[1].y)/2};
					drawDot(halfpt.x,halfpt.y);
					var rad = Math.acos((points[0].x - points[1].x)/len) + (Math.PI/2);
					halfpt.x += Math.cos(rad) * (len * ((180 - tri.dega) / 180));
					halfpt.y += Math.sin(rad) * (len * ((180 - tri.dega) / 180));
					drawDot(halfpt.x,halfpt.y);
					var tri2 = PPP(points[0],halfpt,points[1]);
					quadLine(tri2);
				}
				drawDot(x,y);
				drawText("blah",x + 30,y);
			});
			$("#overlay").mousemove(function(e){
				if(mdown) {
					icount++;
					var x = e.pageX - $("#whiteboard").offset().left;
					var y = e.pageY - $("#whiteboard").offset().top;
					drawLine(x,y);
				}
				$("#footer").html(icount);
			});
		});
		
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


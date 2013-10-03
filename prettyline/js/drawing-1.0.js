var cv;
var ctx;
var h;
var w;
var $ = jQuery;

function initCtx(c) {
	if(typeof c === "string") {
		cv = $(c)[0];
	} else {
		cv = c;
	}
	$(cv).attr({
		width: $(cv).width(),
		height: $(cv).height()
	});
	h = $(cv).height();
	w = $(cv).width();
	if (cv.getContext){
		ctx = cv.getContext('2d');
	} else {
		alert('You need canvas support to view this correctly.');
		ctx = undefined;
	}
}

	
function draw(o, pt) {
	ctx.beginPath();
	if(o instanceof Point) {
		log("DrawDot: " + o);
		ctx.arc(o.x,o.y,4,0,2*Math.PI);
		ctx.stroke();
		ctx.fill();
	} else if(o instanceof Vector) {
		log("DrawVector: " + o);
		var headlen = o.mag() / 10;   // length of head in pixels
		var angle = Math.atan2(o.dy,o.dx);
		ctx.moveTo(o.o.x, o.o.y);
		ctx.lineTo(o.t.x, o.t.y);
		ctx.lineTo(o.t.x-headlen*Math.cos(angle-Math.PI/6),o.t.y-headlen*Math.sin(angle-Math.PI/6));
		ctx.moveTo(o.t.x, o.t.y);
		ctx.lineTo(o.t.x-headlen*Math.cos(angle+Math.PI/6),o.t.y-headlen*Math.sin(angle+Math.PI/6));
		ctx.stroke();
	} else if(o instanceof Line) {
		log("DrawLine: " + o);
		if(o.dx == 0) {
			ctx.moveTo(o.o.x, 0);
			ctx.lineTo(o.t.x, h);
		} else if(o.dy == 0) {
			ctx.moveTo(0, o.o.y);
			ctx.lineTo(w, o.t.y);
		} else {
			var yreps1;
			var xreps1;
			var yreps2;
			var xreps2;
			if(o.dy > 0) {
				yreps1 = o.o.y/o.dy;
				yreps2 = (h-o.o.y)/o.dy;
			} else {
				yreps2 = -o.o.y/o.dy;
				yreps1 = -(h-o.o.y)/o.dy;
			}
			if(o.dx > 0) {
				xreps1 = o.o.x/o.dx;
				xreps2 = (w-o.o.x)/o.dx;
			} else {
				xreps2 = -o.o.x/o.dx;
				xreps1 = -(w-o.o.x)/o.dx;
			}
			var minreps1 = Math.min(yreps1,xreps1);
			var minreps2 = Math.min(yreps2,xreps2);
			var pt1 = new Point(o.o.x-(minreps1*o.dx), o.o.y-(minreps1*o.dy));
			var pt2 = new Point(o.o.x+(minreps2*o.dx), o.o.y+(minreps2*o.dy));
			ctx.moveTo(pt1.x,pt1.y);
			ctx.lineTo(pt2.x,pt2.y);
		}
		ctx.stroke();
	} else if(typeof o === "string") {
		log("DrawString: " + o);
		ctx.fillText(o,pt.x,pt.y);
	}
}

function Pretty() {
	this.pts = [];
}
Pretty.prototype.addPoint = function(p) {
	this.pts.push(p);
	var k = this.pts.length;
	if(k === 3) {
		prettyEnd(this.pts[0],this.pts[1],this.pts[2]);
	} else if (k > 3) {
		pretty4(this.pts[k-4],this.pts[k-3],this.pts[k-2],this.pts[k-1]);
	}
};
Pretty.prototype.endLine = function() {
	var k = this.pts.length;
	if(k > 2) {
		prettyEnd(this.pts[k-1],this.pts[k-2],this.pts[k-3]);
	}
};

function prettyLine(pts) {
	if(pts.length > 2) {
		prettyEnd(pts[0],pts[1],pts[2]);
		for(var i=2;i<pts.length-1;i++) {
			pretty4(pts[i-2],pts[i-1],pts[i],pts[i+1]);
		}
		prettyEnd(pts[pts.length-1],pts[pts.length-2],pts[pts.length-3]);
	}
}

function pretty4(pt1,pt2,pt3,pt4) {
	var v13 = new Vector(pt1,pt3);
	var v42 = new Vector(pt4,pt2);
	var v23 = new Vector(pt2,pt3);
	var magd3 = v23.mag()/3;
	var bp1, bp2;
	v13 = v13.mag(magd3);
	v42 = v42.mag(magd3);
	bp1 = pt2.add(v13);
	bp2 = pt3.add(v42);
	ctx.beginPath();
	ctx.moveTo(pt2.x,pt2.y);
	ctx.bezierCurveTo(bp1.x,bp1.y,bp2.x,bp2.y,pt3.x,pt3.y);
	ctx.stroke();
}

function prettyEnd(pt1,pt2,pt3) {
	var ln = new Line(pt1.midpoint(pt2),pt1,pt2).rotate(Math.PI/2);
	var v31 = new Vector(pt3,pt1);
	var v12 = new Vector(pt1,pt2);
	var magd3 = v12.mag()/3;
	var bp1, bp2;
	v31 = v31.mag(magd3);
	bp1 = pt2.add(v31);
	bp2 = pt1.add(ln.reflect(v31));
	ctx.beginPath();
	ctx.moveTo(pt2.x,pt2.y);
	ctx.bezierCurveTo(bp1.x,bp1.y,bp2.x,bp2.y,pt1.x,pt1.y);
	ctx.stroke();
}

function drawGrid(sz,style) {
	sz = typeof sz !== 'undefined' ? sz : 30;
	style = typeof style !== 'undefined' ? style : "#AAF";
	var laststyle = ctx.strokeStyle;
	ctx.strokeStyle = style;
	for(var i=0;i<w;i+=sz) {
		ctx.beginPath();
		ctx.moveTo(i,0);
		ctx.lineTo(i,h);
		ctx.stroke();
	}
	for(var i=0;i<h;i+=sz) {
		ctx.beginPath();
		ctx.moveTo(0,i);
		ctx.lineTo(w,i);
		ctx.stroke();
	}
	ctx.beginPath();
	ctx.moveTo(0,0);
	ctx.lineTo(Math.min(w,h),Math.min(w,h));
	ctx.stroke();
	ctx.strokeStyle = laststyle;
}

function clearDrawing(redrawGrid) {
	redrawGrid = typeof redrawGrid !== 'undefined' ? redrawGrid : true;
	ctx.save();
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.clearRect(0, 0, cv.width, cv.height);
	ctx.restore();
	drawGrid();
}
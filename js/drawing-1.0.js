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

function prettyLine(pts) {
	prettyEnd(pts[0],pts[1],pts[2]);
	for(var i=2;i<pts.length-1;i++) {
		pretty4(pts[i-2],pts[i-1],pts[i],pts[i+1]);
	}
	prettyEnd(pts[pts.length-1],pts[pts.length-2],pts[pts.length-3]);
}

//Points 1 and 2 come from a straight line
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
	ctx.strokeStyle = "#F0F";
	ctx.stroke();
}

function prettyEnd(pt1,pt2,pt3) {
	var v31 = new Vector(pt3,pt1);
	var v12 = new Vector(pt1,pt2);
	var magd3 = v12.mag()/3;
	var bp1, bp2;
	v31 = v31.mag(magd3);
	bp1 = pt2.add(v31);
	bp2 = pt3.add(v31);
	ctx.beginPath();
	ctx.moveTo(pt2.x,pt2.y);
	ctx.bezierCurveTo(bp1.x,bp1.y,bp2.x,bp2.y,pt3.x,pt3.y);
	ctx.strokeStyle = "#F0F";
	ctx.stroke();
	
	var qp;
	ctx.beginPath();
	ctx.moveTo(pt1.x,pt1.y);
	qp = quadPoint([pt1,pt2,pt3],1);
	ctx.quadraticCurveTo(qp.x,qp.y,pt2.x,pt2.y);
	ctx.strokeStyle = "#F00";
	ctx.stroke();
}

function quadPoint(pts,i) {
	var ln1, ln2, qp;
	if(i === 1) {
		ln1 = new Line(pts[0].midpoint(pts[1]),pts[1]).rotate(Math.PI/2);
		ln2 = new Line(pts[1],pts[0],pts[2]);
		qp = ln1.intersect(ln2);
	} else if (i === pts.length - 1) {
		ln1 = new Line(pts[i].midpoint(pts[i-1]),pts[i]).rotate(Math.PI/2);
		ln2 = new Line(pts[i-1],pts[i],pts[i-2]);
		qp = ln1.intersect(ln2);
	} else {
		ln1 = new Line(pts[i],pts[i-1],pts[i+1]);
		ln2 = new Line(pts[i-1],pts[i-2],pts[i]);
		qp = ln1.intersect(ln2);
	}
	//draw(ln1);
	//draw(ln2);
	//draw(qp);
	return qp;
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
/*jshint -W117 */
/*jshint -W098 */
var cv;
var ctx;
var h;
var w;
var drawColor;
var drawMode = "pen";

function setColor(c) {
	c = typeof c !== 'undefined' ? c : drawColor;
	drawColor = new Color(c);
	if(drawMode == "pen" || drawMode == "eraser") {
		drawColor.rgba.a = 1;
	}
	if(drawMode == "highlighter") {
		drawColor.rgba.a = 0.3;
	}
	ctx.strokeStyle = drawColor.toString();
	ctx.fillStyle = drawColor.toString();
	$("#tools,#bgs,#functions").css({color:drawColor.hex});
	$(".size").css({background:drawColor.hex});
}

function drawWith(tool) {
	if (tool == "eraser") {
		drawMode = "eraser";
		ctx.globalCompositeOperation = "destination-out";
	} else if (tool == "pen") {
		drawMode = "pen";
		ctx.globalCompositeOperation = "source-over";
	} else if (tool == "highlighter") {
		drawMode = "highlighter";
		ctx.globalCompositeOperation = "source-over";
	}
	setColor();
}

function Color(c) {
	var result;
	if(typeof c === "string") {
		if(c.charAt(0)=="#"){
			this.hex = this.fromShorthand(c);
			this.rgba = this.hexToRGBA(this.hex);
		} else if (c.substring(0,4) == "rgb(") {
			result = /rgb\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i.exec(c);
			this.rgba = result ? {
				r: parseFloat(result[1]),
				g: parseFloat(result[2]),
				b: parseFloat(result[3]),
				a: 1
			} : null;
			this.hex = this.rgbaToHex(this.rgba);
		} else if (c.substring(0,4) == "rgba") {
			result = /rgba\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d*.?\d*)\s*\)/i.exec(c);
			this.rgba = result ? {
				r: parseFloat(result[1]),
				g: parseFloat(result[2]),
				b: parseFloat(result[3]),
				a: parseFloat(result[4])
			} : null;
			this.hex = this.rgbaToHex(this.rgba);
		}
	} else if (c.hex && c.rgba) {
		this.hex = c.hex;
		this.rgba = {
			r: c.rgba.r,
			g: c.rgba.g,
			b: c.rgba.b,
			a: c.rgba.a
		};
	}
}
Color.prototype.fromShorthand = function(hex) {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    return hex.replace(shorthandRegex, function(m, r, g, b) {
        return "#" + r + r + g + g + b + b;
    });

};
Color.prototype.hexToRGBA = function(hex) {
	hex = this.fromShorthand(hex);
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
		a: 1
    } : null;
};
Color.prototype.rgbaToHex = function(rgba) {
    return "#" + ((1 << 24) + (rgba.r << 16) + (rgba.g << 8) + rgba.b).toString(16).slice(1);
};
Color.prototype.toString = function() {
	return "rgba(" + this.rgba.r + ", " + this.rgba.g + ", " + this.rgba.b + ", " + this.rgba.a + ")";
};

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
		ctx.lineWidth = 2;
		setColor("#1F7ABD");
	} else {
		alert('You need canvas support to view this correctly.');
		ctx = undefined;
	}
}

	
function draw(o, pt) {
	ctx.beginPath();
	if(o instanceof Point) {
		log("DrawDot: " + o);
		/*
		ctx.moveTo(o.x,o.y);
		ctx.lineTo(o.x+1,o.y);
		ctx.stroke();
		*/
		ctx.arc(o.x,o.y,ctx.lineWidth/2,0,2*Math.PI);
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
		if(o.dx === 0) {
			ctx.moveTo(o.o.x, 0);
			ctx.lineTo(o.t.x, h);
		} else if(o.dy === 0) {
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

function Pretty(json) {
	this.pts = [];
	if(json) {
		var lastc = drawColor;
		var lastw = ctx.lineWidth;
		var lastt = drawMode;
		setColor(json.color);
		ctx.lineWidth = json.lineWidth;
		drawWith(json.drawMode);
		this.magsum = json.magsum;
		this.pts.push(new Point(json.pts[0].x,json.pts[0].y));
		if(json.pts.length > 2) {
			for(var i=1;i<json.pts.length;i++) {
				p = new Point(json.pts[i].x,json.pts[i].y);
				this.pts.push(p);
				var k = this.pts.length;
				if(k === 3) {
					prettyEnd(this.pts[0],this.pts[1],this.pts[2]);
				} else if (k > 3) {
					pretty4(this.pts[k-4],this.pts[k-3],this.pts[k-2],this.pts[k-1]);
				}
			}
			this.endLine();
		} else if (json.pts.length == 2) {
			pt1 = new Point(json.pts[0].x,json.pts[0].y);
			pt2 = new Point(json.pts[1].x,json.pts[1].y);
			this.pts.push(pt1);
			this.pts.push(pt2);
			simpleLine(pt1,pt2);
		} else if (json.pts.length == 1) {
			p = new Point(json.pts[0].x,json.pts[0].y);
			this.pts.push(p);
			draw(p);
		}
		setColor(lastc);
		ctx.lineWidth = lastw;
		drawWith(lastt);
	} else {
		this.magsum = 0;
		this.color = drawColor;
		this.drawMode = drawMode;
		this.lineWidth = ctx.lineWidth;
	}
}
Pretty.prototype.addPoint = function(p) {
	if(this.pts.length > 0) {
		if(p.x == this.pts[this.pts.length-1].x && p.y == this.pts[this.pts.length-1].y) {
			return;
		}
		var v = new Vector(this.pts[this.pts.length-1],p);
		this.magsum += v.mag();
		if(this.magsum > 20 || this.pts.length < 20) {
			this.pts.push(p);
			this.magsum = 0;
			var k = this.pts.length;
			if(k === 3) {
				prettyEnd(this.pts[0],this.pts[1],this.pts[2]);
			} else if (k > 3) {
				pretty4(this.pts[k-4],this.pts[k-3],this.pts[k-2],this.pts[k-1]);
			}
		}
	} else {
		this.pts.push(p);
	}
};
Pretty.prototype.endLine = function() {
	var k = this.pts.length;
	if(k > 2) {
		prettyEnd(this.pts[k-1],this.pts[k-2],this.pts[k-3]);
	} else if (k == 2) {
		simpleLine(this.pts[0],this.pts[1]);
	} else if (k == 1) {
		draw(this.pts[0]);
	}
};

function simpleLine(pt1,pt2) {
	ctx.beginPath();
	ctx.moveTo(pt1.x,pt1.y);
	ctx.lineTo(pt2.x,pt2.y);
	ctx.stroke();
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
	if(drawMode != "highlighter") {
		draw(pt3);
	}
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
	if(drawMode != "highlighter") {
		draw(pt1);
		draw(pt2);
	}
}

function drawGrid(sz,strokeStyle,lineWidth) {
	var i;
	sz = typeof sz !== 'undefined' ? sz : 30;
	strokeStyle = typeof style !== 'undefined' ? style : "#AAF";
	lineWidth = typeof style !== 'undefined' ? style : 1;
	var lastStrokeStyle = ctx.strokeStyle;
	ctx.strokeStyle = strokeStyle;
	var lastLineWidth = ctx.lineWidth;
	ctx.lineWidth = lineWidth;
	for(i=0;i<w;i+=sz) {
		ctx.beginPath();
		ctx.moveTo(i,0);
		ctx.lineTo(i,h);
		ctx.stroke();
	}
	for(i=0;i<h;i+=sz) {
		ctx.beginPath();
		ctx.moveTo(0,i);
		ctx.lineTo(w,i);
		ctx.stroke();
	}
	ctx.beginPath();
	ctx.moveTo(0,0);
	ctx.lineTo(Math.min(w,h),Math.min(w,h));
	ctx.stroke();
	ctx.strokeStyle = lastStrokeStyle;
	ctx.lineWidth = lastLineWidth;
}

function clearDrawing(redrawGrid) {
	redrawGrid = typeof redrawGrid !== 'undefined' ? redrawGrid : true;
	ctx.save();
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.clearRect(0, 0, cv.width, cv.height);
	ctx.restore();
	if(redrawGrid) {
		drawGrid();
	}
}

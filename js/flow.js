/*jshint -W117 */
/*jshint -W098 */

//Requires color.js, linearalgebra-1.0.js and surface.js


function Flow(opt) {
	opt = typeof opt === "undefined" ? {} : opt;
	var sopt = {};
	if (typeof opt.surface === "undefined") {
		sopt = {
			color:"#000",
			tool:"pen",
			strokeWidth:3
		};
	}
	sopt.color = typeof opt.color === "undefined" ? sopt.color : opt.color;
	sopt.tool = typeof opt.tool === "undefined" ? sopt.tool : opt.tool;
	sopt.strokeWidth = typeof opt.strokeWidth === "undefined" ? sopt.strokeWidth : opt.strokeWidth;
	
	this.p = [];
	//If points have been supplied
	if(typeof opt.points !== "undefined") {
		this.s = hiddensurface;
		this.start(opt.points[0]);
		this.p = opt.points;
		this.redraw();
		//If no surface has been supplied
		if (typeof opt.surface === "undefined") {
			$.extend(sopt, {
				x:this.minx - (2*sopt.strokeWidth),
				y:this.miny - (2*sopt.strokeWidth),
				offsetx:this.minx - (2*sopt.strokeWidth),
				offsety:this.miny - (2*sopt.strokeWidth),
				w:this.maxx - this.minx + (4*sopt.strokeWidth),
				h:this.maxy - this.miny + (4*sopt.strokeWidth)
			});
		}
	}
	if (typeof opt.surface === "undefined") {
		opt.surface = new Surface(sopt);
	} else {
		if(typeof opt.color != "undefined") {opt.surface.color(opt.color);}
		if(typeof opt.tool != "undefined") {opt.surface.tool(opt.tool);}
		if(typeof opt.strokeWidth != "undefined") {opt.surface.strokeWidth(opt.strokeWidth);}
	}
	this.s = opt.surface;
	this.c = this.s.color();
	this.t = this.s.tool();
	this.sw = this.s.strokeWidth();
	this.redraw();
}

Flow.prototype = {
	surface: function(s) {
		if(typeof s == "undefined") {
			return this.s;
		} else {
			s.color(this.color());
			s.tool(this.tool());
			s.strokeWidth(this.strokeWidth());
			this.s = s;
		}
	},
	start: function(pt,y) {
		pt = typeof y == "number" ?	pt = new Point(pt,y) : pt;
		this.p = [pt];
		this.minx = pt.x;
		this.miny = pt.y;
		this.maxx = pt.x;
		this.maxy = pt.y;
		this.magsum = 0;
		this.redraw();
	},
	point: function(pt,y) {
		pt = typeof y == "number" ?	pt = new Point(pt,y) : pt;
		if(this.p.length === 0) {
			this.start(pt);
		}
		if(pt.x == this.p[this.p.length-1].x && pt.y == this.p[this.p.length-1].y) {
			return;
		}
		var v = new Vector(this.p[this.p.length-1],pt);
		var mag = v.mag();
		this.magsum += mag;
		if(this.magsum > 30 || mag < 10 || this.p.length < 40) {
			this.p.push(pt);
			var k = this.p.length;
			this.setMinMax(pt);
			this.magsum = 0;
			if (this.p.length == 3) {
				this.s.ctx.beginPath();
				this.line3a(this.p[0],this.p[1],this.p[2]);
				this.s.ctx.stroke();
			} else if (this.p.length > 3) {
				this.s.ctx.beginPath();
				this.s.moveTo(this.p[this.p.length-3]);
				this.line4(this.p[this.p.length-4],this.p[this.p.length-3],this.p[this.p.length-2],this.p[this.p.length-1]);
				this.s.ctx.stroke();
			}
		}
	},
	points: function(pts) {
		for(var i=0;i<pts.length;i++) {
			if(pts[i] instanceof Point) {
				this.point(pts[i]);
			} else {
				this.point(pts[i][0],pts[i][1]);
			}
		}
	},
	redraw: function() {
		var k = this.p.length;
		if(k === 0) return;
		if(k === 1) {
			this.s.dot(this.p[0]);
			return;
		}
		this.s.color(this.c);
		this.s.tool(this.t);
		this.s.strokeWidth(this.sw);
		this.s.ctx.beginPath();
		if(k === 2) {
			this.line2(this.p[0],this.p[1]);
		} else if(k >= 3) {
			this.line3a(this.p[0],this.p[1],this.p[2]);
			for(var i=0;i<k-3;i++) {
				this.line4(this.p[i],this.p[i+1],this.p[i+2],this.p[i+3]);
			}
			this.line3b(this.p[k-3],this.p[k-2],this.p[k-1]);
		}
		this.s.ctx.stroke();
		if(this.tool() != "highlighter") {
			this.s.dot(this.p[0]);
			this.s.dot(this.p[k-1]);
		}
		var oldc = this.color();
		//this.color("#F00");
		//this.dots();
		//this.color(oldc);
	},
	dots: function() {
		var k = this.p.length;
		for(var i=0;i<k;i++) {
			this.s.dot(this.p[i]);
		}
	},
	color: function (color) {
		if(typeof color == "undefined") {
			return this.c;
		} else {
			this.c = new Color(color);
			this.s.color(this.c);
		}
	},
	tool: function (tool) {
		if(typeof tool == "undefined") {
			return this.t;
		} else {
			this.t = tool;
			this.s.tool(tool);
		}
	},
	strokeWidth: function(w) {
		if(typeof w == "undefined") {
			return this.sw;
		} else {
			this.sw = w;
			this.s.strokeWidth(w);
		}
	},
	//Draw a straight line between pt1 and pt2
	line2: function(pt1,pt2) {
		this.s.moveTo(pt1);
		this.s.lineTo(pt2);
	},
	//Start drawing the Flow between pt1 and pt2 that curves to fit the later pt3
	line3a: function(pt1,pt2,pt3) {
		var ln = new Line(pt1.midpoint(pt2),pt1,pt2).rotate(Math.PI/2);
		var v31 = new Vector(pt3,pt1);
		var v12 = new Vector(pt1,pt2);
		var magd3 = v12.mag()/3;
		var bp1, bp2;
		v31 = v31.mag(magd3);
		bp1 = pt2.add(v31);
		bp2 = pt1.add(ln.reflect(v31));
		this.setMinMax(bp1);
		this.setMinMax(bp2);
		this.s.moveTo(pt1);
		this.s.bezierCurveTo(bp2,bp1,pt2);
	},
	//Finish drawing the Flow between pt2 and pt3 that curves to fit the earlier pt1
	line3b: function(pt1,pt2,pt3) {
		var ln = new Line(pt3.midpoint(pt2),pt3,pt2).rotate(Math.PI/2);
		var v13 = new Vector(pt1,pt3);
		var v32 = new Vector(pt3,pt2);
		var magd3 = v32.mag()/3;
		var bp1, bp2;
		v13 = v13.mag(magd3);
		bp1 = pt2.add(v13);
		bp2 = pt3.add(ln.reflect(v13));
		this.setMinMax(bp1);
		this.setMinMax(bp2);
		this.s.bezierCurveTo(bp1,bp2,pt3);
	},
	//Continue drawing the Flow between pt2 and pt3 that curves to fit pt1 and pt4
	line4: function(pt1,pt2,pt3,pt4) {
		var v13 = new Vector(pt1,pt3);
		var v42 = new Vector(pt4,pt2);
		var v23 = new Vector(pt2,pt3);
		var magd3 = v23.mag()/3;
		var bp1, bp2;
		v13 = v13.mag(magd3);
		v42 = v42.mag(magd3);
		bp1 = pt2.add(v13);
		bp2 = pt3.add(v42);
		this.setMinMax(bp1);
		this.setMinMax(bp2);
		this.s.bezierCurveTo(bp1,bp2,pt3);
	},
	setMinMax: function(pt) {
		this.minx = Math.min(pt.x,this.minx);
		this.miny = Math.min(pt.y,this.miny);
		this.maxx = Math.max(pt.x,this.maxx);
		this.maxy = Math.max(pt.y,this.maxy);
	}
};

Flow.serialize = function(flow) {
	return [
		Point.serialize(flow.p),
		Color.serialize(flow.color()),
		flow.tool(),
		flow.strokeWidth()
	];
};
Flow.deserialize = function(data) {
	return new Flow({
		points: Point.deserialize(data[0]),
		color: data[1],
		tool: data[2],
		strokeWidth: data[3]
	});
};
/*jshint -W117 */
/*jshint -W098 */

function Pretty(json,drawImmediately) {
	this.pts = [];
	if(json) {
		var lastc = drawColor;
		var lastw = lineWidth();
		var lastt = drawMode;
		setColor(json.color);
		lineWidth(json.lineWidth);
		drawWith(json.drawMode);
		this.magsum = 0;
		this.color = drawColor;
		this.drawMode = drawMode;
		this.lineWidth = lineWidth();
		if(drawImmediately) {
			if(json.pts.length > 2) {
				this.pts.push(new Point(json.pts[0].x,json.pts[0].y));
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
				dot(p);
			}
		}
		setColor(lastc);
		lineWidth(lastw);
		drawWith(lastt);
	} else {
		this.magsum = 0;
		this.color = drawColor;
		this.drawMode = drawMode;
		this.lineWidth = lineWidth();
	}
}
Pretty.prototype.addPoint = function(p) {
	if(this.pts.length > 0) {
		if(p.x == this.pts[this.pts.length-1].x && p.y == this.pts[this.pts.length-1].y) {
			return;
		}
		var v = new Vector(this.pts[this.pts.length-1],p);
		var mag = v.mag();
		this.magsum += mag;
		if(this.magsum > 30 || mag < 10 || this.pts.length < 20) {
			this.addPointAndDraw(p,mag);
		}
	} else {
		this.pts.push(p);
	}
};
Pretty.prototype.addPointAndDraw = function (p,mag) {
	var v = new Vector(this.pts[this.pts.length-1],p);
	this.pts.push(p);
	this.magsum = 0;
	var k = this.pts.length;
	if(k === 3 && drawMode != "highlighter") {
		prettyEnd(this.pts[0],this.pts[1],this.pts[2]);
	} else if (k > 3) {
//		if(mag < 10) {
//			simpleLine(this.pts[k-3],this.pts[k-2]);
//		} else {
		pretty4(this.pts[k-4],this.pts[k-3],this.pts[k-2],this.pts[k-1]);
//		}
	}
};
Pretty.prototype.endLine = function() {
	var k = this.pts.length;
	if(k > 2 && drawMode != "highlighter") {
		prettyEnd(this.pts[k-1],this.pts[k-2],this.pts[k-3]);
	} else if (k == 2) {
		simpleLine(this.pts[0],this.pts[1]);
	} else if (k == 1) {
		dot(this.pts[0]);
	}
};

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
	drawBoth(function(ctx) {
		ctx.beginPath();
		ctx.moveTo(pt2.x,pt2.y);
		ctx.bezierCurveTo(bp1.x,bp1.y,bp2.x,bp2.y,pt3.x,pt3.y);
		ctx.stroke();
		if(drawMode != "highlighter") {
			dot(pt3);
		}
	});
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
	drawBoth(function(ctx) {
		ctx.beginPath();
		ctx.moveTo(pt2.x,pt2.y);
		ctx.bezierCurveTo(bp1.x,bp1.y,bp2.x,bp2.y,pt1.x,pt1.y);
		ctx.stroke();
		if(drawMode != "highlighter") {
			dot(pt1);
			dot(pt2);
		}
	});
}
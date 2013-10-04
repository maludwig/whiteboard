/*jshint -W117 */
/*jshint -W098 */

var verbose = false;

function Point(x,y) {
	if(x instanceof Point) {
		this.x = x.x;
		this.y = x.y;
	} else {
		this.x = x;
		this.y = y;		
	}
	if(verbose) {if(typeof draw !== 'undefined'){draw(this);}}
	//if(typeof draw !== 'undefined'){draw(this);}
}
Point.ORIGIN = new Point(0,0);
Point.prototype.midpoint = function(p) {
	return new Point((this.x + p.x)/2,(this.y + p.y)/2);
};
Point.prototype.add = function(v) {
	return new Point(this.x + v.dx, this.y + v.dy);
};
Point.prototype.toString = function() {
	return "[" + this.x + ", " + this.y + "]";
};

function Vector(o,t) {
	if(o instanceof Vector) {
		this.o = new Point(o.o);
		this.t = new Point(o.t);
	} else if(o instanceof Point) {
		if(!t){
			t = o;
			o = new Point(0,0);
		}
		this.o = o;
		this.t = t;
	} else if (typeof o === "number") {
		this.o = Point.ORIGIN;
		this.t = new Point(o,t);
	}
	this.dx = this.t.x - this.o.x;
	this.dy = this.t.y - this.o.y;
	if(verbose) {if(typeof draw !== 'undefined'){draw(this);}}
}
Vector.prototype.add = function(v) {
	return new Vector(this.dx + v.dx, this.dy + v.dy);
};
Vector.prototype.sub = function(v) {
	return new Vector(this.dx - v.dx, this.dy - v.dy);
};
Vector.prototype.mul = function(m) {
	return new Vector(this.dx * m, this.dy * m);
};
Vector.prototype.div = function(d) {
	return new Vector(this.dx / d, this.dy / d);
};
Vector.prototype.dot = function(v) {
	return (this.dx * v.dx) + (this.dy * v.dy);
};
Vector.prototype.mag = function(m) {
	var curmag = Math.sqrt((this.dx * this.dx) + (this.dy * this.dy));
	if(m) {
		var newdx = this.dx * (m / curmag);
		var newdy = this.dy * (m / curmag);
		return new Vector(newdx,newdy);
	} else {
		return curmag;
	}
};
Vector.prototype.magsq = function() {
	return (this.dx * this.dx) + (this.dy * this.dy);
};
Vector.prototype.rotate = function(rad) {
	rad += Math.PI;
	var angle = this.angle();
	var newx = this.o.x-this.mag()*Math.cos(angle-rad);
	var newy = this.o.y-this.mag()*Math.sin(angle-rad);
	return new Vector(new Point(this.o), new Point(newx,newy));
};
Vector.prototype.angle = function() {
	return Math.atan2(this.dy,this.dx);
};
Vector.prototype.angleFrom = function(v) {
	var a = this.angle() - v.angle();
	if(a > Math.PI) {
		a = (-2*Math.PI) + a;
	}
	if(a < -Math.PI) {
		a = (2*Math.PI) + a;
	}
	return a;
};
Vector.prototype.terminus = function() {
	return new Point(this.dx,this.dy);
};
Vector.prototype.toPoint = function() {
	return new Point(this.dx,this.dy);
};
Vector.prototype.toString = function() {
	return "[" + this.dx + ", " + this.dy + "]";
};

function Line(o,dx,dy) {
	if(o instanceof Line) {
		this.o = new Point(o.o);
		this.dx = o.dx;
		this.dy = o.dy;
	} else {
		this.o = o;
		if(dx instanceof Vector) {
			this.dx = dx.dx;
			this.dy = dx.dy;
		} else if(dx instanceof Point) {
			if(!dy) {
				dy = dx;
				dx = o;
			}
			this.dx = dx.x - dy.x;
			this.dy = dx.y - dy.y;
		} else {
			this.dx = dx;
			this.dy = dy;
		}
	}
	this.t = new Point(this.o.x + this.dx,this.o.y + this.dy);
	this.v = new Vector(this.o,this.t);	
	if(verbose) {if(typeof draw !== 'undefined'){draw(this);}}
}
Line.prototype.reflect = function(p) {
	if(p instanceof Point) {
		var vop = new Vector(this.o,p);
		var v0p = new Vector(p);
		var proj = this.v.mul(this.v.dot(vop)/this.v.magsq());
		var vpd = proj.sub(vop).mul(2);
		var v0d = v0p.add(vpd);
		return v0d.terminus();
	} else if(p instanceof Vector) {
		var p1 = this.reflect(p.o);
		var p2 = this.reflect(p.t);
		return new Vector(p1,p2);
	}
};
Line.prototype.rotate = function(rad) {
	return new Line(new Point(this.o), this.v.rotate(rad));
};
Line.prototype.angle = function() {
	return Math.atan2(this.dy,this.dx);
};
Line.prototype.intersect = function(ln) {
	if(this.dx === 0) {
		if(ln.dx === 0) {
			throw "No intersection";
		} else {
			return new Point(this.o.x,(ln.dy/ln.dx)*(this.o.x-ln.o.x)+ln.o.y);
		}
	}
	if(ln.dx === 0) {
		return new Point(ln.o.x,(this.dy/this.dx)*(ln.o.x-this.o.x)+this.o.y);
	}
	var sl1 = this.dy/this.dx;
	var sl2 = ln.dy/ln.dx;
	if(sl1 == sl2) {
		throw "No intersection";
	} else {
		var xi1 = this.o.y - (sl1 * this.o.x);
		var xi2 = ln.o.y - (sl2 * ln.o.x);
		var x = (xi2-xi1) / (sl1-sl2);
		var y = (sl1*x)+xi1;
		return new Point(x,y);
	}
};
Line.prototype.toString = function() {
	return "o" + this.o + "->[" + this.dx + ", " + this.dy + "]";
};

function Matrix(o) {
	if(o instanceof Matrix) {
		this.data = o.data;
	} else {
		this.data = o;
	}
	this.h = this.data.length;
	this.w = this.data[0].length;
}
Matrix.prototype.row = function(k) {
	return this.data[k];
};
Matrix.prototype.col = function(k) {
	var ret = [];
	for(var y=0;y<this.data.length;y++){
		ret.push(this.data[y][k]);
	}
	return ret;
};
Matrix.prototype.mul = function(m) {
	var newdata = [],x,y;
	if(m instanceof Matrix) {
		var rowa, colb, rowc,sum;
		for(y=0;y<this.h;y++) {
			rowa = this.row(y);
			rowc = [];
			for(x=0;x<m.w;x++) {
				sum = 0;
				colb = m.col(x);
				for(var i=0;i<this.w;i++) {
					sum += rowa[i] * colb[i];
				}
				rowc.push(sum);
			}
			newdata.push(rowc);
		}
		return new Matrix(newdata);
	} else {
		var row;
		for(y=0;y<this.h;y++) {
			row = [];
			for(x=0;x<this.w;x++) {
				row.push(m*this.data[y][x]);
			}
			newdata.push(row);
		}
		return new Matrix(newdata);
	}
};
Matrix.prototype.toString = function() {
	var s = "{\n";
	for(var i=0;i<this.data.length;i++) {
		s += this.data[i].toString() + "\n";
	}
	s += "}";
	return s;
};

function Triangle(a,b,c) {
	var abx = a.x - b.x, acx = a.x - c.x, bcx = b.x - c.x;
	var aby = a.y - b.y, acy = a.y - c.y, bcy = b.y - c.y;
	this.a = a;
	this.b = b;
	this.c = c;
	this.lena = Math.sqrt((bcx * bcx) + (bcy * bcy));
	this.lenb = Math.sqrt((acx * acx) + (acy * acy));
	this.lenc = Math.sqrt((abx * abx) + (aby * aby));
	this.rada = Math.acos(((this.lenb * this.lenb) + (this.lenc * this.lenc) - (this.lena * this.lena))/(2 * this.lenb * this.lenc));
	this.radb = Math.acos(((this.lena * this.lena) + (this.lenc * this.lenc) - (this.lenb * this.lenb))/(2 * this.lena * this.lenc));
	this.radc = (Math.PI) - (this.rada + this.radb);
	this.dega = this.rada * (180 / Math.PI);
	this.degb = this.radb * (180 / Math.PI);
	this.degc = this.radc * (180 / Math.PI);
}

function sign(x) { return x > 0 ? 1 : x < 0 ? -1 : 0; }
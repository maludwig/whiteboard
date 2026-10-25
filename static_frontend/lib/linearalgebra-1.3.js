/**
 * Linear Algebra package.
 * 
 * All work is done in radians unless otherwise specified.
 * 
 * Available objects include Point, Box, Vector, Line, Matrix, Triangle
 */

//Specifies a point in cartesian coordinates.
//Accepts a Point, an object with left and top properties (as from jQuery offset() and position()), or a numeric x and y coordinate
function Point(x,y) {
	if(x instanceof Point) {
		this.x = x.x;
		this.y = x.y;
    } else if (typeof x.top === "number" && typeof x.left === "number") {
        this.x = x.left;
        this.y = x.top;
	} else {
		this.x = x;
		this.y = y;		
	}
}
//The point at (0,0)
Point.ORIGIN = new Point(0,0);
//Returns a new Point representing the midpoint between the current Point and the input Point
Point.prototype.midpoint = function(p) {
	return new Point((this.x + p.x)/2,(this.y + p.y)/2);
};
//Adds a Vector to the current Point, and returns the result as a new Point
Point.prototype.add = function(v) {
	return new Point(this.x + v.dx, this.y + v.dy);
};
//Subtracts a Vector from the current Point, and returns the result as a new Point
Point.prototype.subtract = function(v) {
	return new Point(this.x - v.dx, this.y - v.dy);
};
//Returns true if the current Point is in the input Box, false otherwise
Point.prototype.inside = function(box) {
    return this.x >= box.left &&
        this.x < box.right &&
        this.y >= box.top &&
        this.y < box.bottom;
};
Point.prototype.toString = function() {
	return "[" + this.x + ", " + this.y + "]";
};
//Serializes the a point or set of points into an array of numeric coordinates
Point.serialize = function(pt) {
	if(pt instanceof Point) {
		return [pt.x,pt.y];
	} else {
		var ret = [];
		for(var i=0;i<pt.length;i++) {
			ret.push(pt[i].x);
			ret.push(pt[i].y);
		}
		return ret;
	}
};
//Returns an array of Points from an array of numeric coordinates
Point.deserialize = function(data) {
	var ret = [];
	for(var i=0;i<data.length;i+=2) {
		ret.push(new Point(data[i],data[i+1]));
	}
	return ret;
};
//Returns the smallest Box that could contain all of the Points
Point.boundingbox = function(points) {
	var pts = arguments.length == 1 ? points : arguments;
	var minx=pts[0].x,miny=pts[0].y,maxx=pts[0].x,maxy=pts[0].y;
	for(var i=1;i<pts.length;i++) {
		minx = Math.min(pts[i].x,minx);
		miny = Math.min(pts[i].y,miny);
		maxx = Math.max(pts[i].x,maxx);
		maxy = Math.max(pts[i].y,maxy);
	}
    return new Box(minx,miny,maxx,maxy);
};

//Represents a rectangle
//If the input parameter is a Box, returns a duplicate of the Box
//If the input parameter is two Points, returns the smallest Box that could contain both Points
//If the input is four numbers, they are treated as the cartesian coordinates of two Points, returns the smallest Box that could contain both Points
//Mostly for convenience, this calculates each corner Point, the width, the height, and the top, bottom, left, and right coordinates.
function Box(x1,y1,x2,y2) {
    var p1, p2, swap;
    if(x1 instanceof Box) {
        this.x1 = x1.x1;
        this.y1 = x1.y1;
        this.x2 = x1.x2;
        this.y2 = x1.y2;
    } else if (x1 instanceof Point && y1 instanceof Point) {
        this.x1 = x1.x;
        this.y1 = x1.y;
        this.x2 = y1.x;
        this.y2 = y1.y;
    } else {
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
    }
    if (this.x1 > this.x2) { swap = this.x1; this.x1 = this.x2; this.x2 = swap; }
    if (this.y1 > this.y2) { swap = this.y1; this.y1 = this.y2; this.y2 = swap; }
    this.p1 = new Point(this.x1,this.y2);
    this.p2 = new Point(this.x2,this.y2);
    this.left = this.x1;
    this.top = this.y1;
    this.right = this.x2;
    this.bottom = this.y2;
    this.width = this.x2 - this.x1;
    this.height = this.y2 - this.y1;
    this.topleft = this.p1;
    this.lefttop = this.topleft;
    this.topright = new Point(this.right,this.top);
    this.righttop = this.topright;
    this.bottomleft = new Point(this.left, this.bottom);
    this.leftbottom = this.bottomleft;
    this.bottomright = this.p2;
    this.rightbottom = this.bottomright;
}
Box.prototype.toString = function() {
	return "{left:" + this.left + ", top:" + this.top + ", right:" + this.right + ", bottom:" + this.bottom + "}";
};

//Represents a Vector
//If the input parameter is a Vector, returns a duplicate of the Vector
//If the input is a single Point, returns the Vector pointing from the Origin (0,0) to the input point
//If the input is two Points, returns the Vector pointing from the first input to the second
//If the input is two numbers, treats those numbers as coordinates of a Point, and returns the Vector pointing from the Origin to that Point
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
}
//Adds the input Vector to the current Vector, returns the result as a new Vector
Vector.prototype.add = function(v) {
	return new Vector(this.dx + v.dx, this.dy + v.dy);
};
//Subtracts the input Vector from the current Vector, returns the result as a new Vector
Vector.prototype.sub = function(v) {
	return new Vector(this.dx - v.dx, this.dy - v.dy);
};
//Multiplies the Vector magnitude by the input number, without changing the angle
Vector.prototype.mul = function(m) {
	return new Vector(this.dx * m, this.dy * m);
};
//Divides the Vector magnitude by the input number, without changing the angle
Vector.prototype.div = function(d) {
	return new Vector(this.dx / d, this.dy / d);
};
//Returns the dot product of the current Vector with the input Vector
Vector.prototype.dot = function(v) {
	return (this.dx * v.dx) + (this.dy * v.dy);
};
//If no input is provided, returns the magnitude of the Vector
//If a numeric input is provided, sets the magnitude of the current Vector without changing the angle
Vector.prototype.mag = function(m) {
	var curmag = Math.sqrt((this.dx * this.dx) + (this.dy * this.dy));
	if(typeof m !== 'undefined') {
		var newdx = this.dx * (m / curmag);
		var newdy = this.dy * (m / curmag);
		return new Vector(newdx,newdy);
	} else {
		return curmag;
	}
};
//Returns the square of the current Vector's magnitude, used as a faster calculation
Vector.prototype.magsq = function() {
	return (this.dx * this.dx) + (this.dy * this.dy);
};
//Rotates the current Vector's angle by the input, in radians, without changing the magnitude
Vector.prototype.rotate = function(rad) {
	rad += Math.PI;
	var angle = this.angle();
	var newx = this.o.x - this.mag()*Math.cos(angle-rad);
	var newy = this.o.y - this.mag()*Math.sin(angle-rad);
	return new Vector(new Point(this.o), new Point(newx,newy));
};
//Returns the current Vector's angle
Vector.prototype.angle = function() {
	return Math.atan2(this.dy,this.dx);
};
//Returns the difference between the current Vector's angle and the input Vector's angle
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
//Calculates the Point that would result from the addition of the current Vector to the Origin
Vector.prototype.terminus = function() {
	return new Point(this.dx,this.dy);
};
Vector.prototype.toPoint = function() {
	return new Point(this.dx,this.dy);
};
Vector.prototype.toString = function() {
	return "[" + this.dx + ", " + this.dy + "]";
};

//Represents a straight line with no fixed beginning or end
//If the input is a Line, creates a new duplicate of the Line
//If the first input is a Point, and the second input is a Vector, returns the Line that intersects the Point with the same angle as the Vector
//If the first input is a Point, and the second input is a Point, returns the Line intersecting both Points
//If the first input is a Point, and the second and third inputs are numeric, returns the Line intersecting the Point, with a slope specified by the numeric inputs
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
}
//If the input is a Point, calculates the reflection of the Point across the Line, and returns the result as a new Point
//If the input is a Vector, calculates the reflection of the Vector across the Line, and returns the result as a new Vector
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
//Rotate the line about the Origin point
Line.prototype.rotate = function(rad) {
	return new Line(new Point(this.o), this.v.rotate(rad));
};
//Return the angle of the Line
Line.prototype.angle = function() {
	return Math.atan2(this.dy,this.dx);
};
//If the current Line and the input Line intersect, calculate their intersection and return the Point
//Throws an error of the Lines do not intersect
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

//Accepts either an existing Matrix or an array of arrays of numbers as input
function Matrix(o) {
	if(o instanceof Matrix) {
		this.data = o.data;
	} else {
		this.data = o;
	}
	this.h = this.data.length;
	this.w = this.data[0].length;
}
//Returns a single row from the Matrix
Matrix.prototype.row = function(k) {
	return this.data[k];
};
//Returns a single column from the Matrix
Matrix.prototype.col = function(k) {
	var ret = [];
	for(var y=0;y<this.data.length;y++){
		ret.push(this.data[y][k]);
	}
	return ret;
};
//Multiplies the current matrix by the input, returns a new Matrix
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

//Accepts 3 Points, a, b, and c, that define the Triangle.
function Triangle(a,b,c) {
    //Precalculate the distance (vertical and horizontal) between each point.
	var abx = a.x - b.x, acx = a.x - c.x, bcx = b.x - c.x;
	var aby = a.y - b.y, acy = a.y - c.y, bcy = b.y - c.y;
	this.a = a;
	this.b = b;
	this.c = c;
    //Calculate the length of each side. lena is the length of the side opposite to Point a
	this.lena = Math.sqrt((bcx * bcx) + (bcy * bcy));
	this.lenb = Math.sqrt((acx * acx) + (acy * acy));
	this.lenc = Math.sqrt((abx * abx) + (aby * aby));
    //Calculate the angle, in radians, of each point
	this.rada = Math.acos(((this.lenb * this.lenb) + (this.lenc * this.lenc) - (this.lena * this.lena))/(2 * this.lenb * this.lenc));
	this.radb = Math.acos(((this.lena * this.lena) + (this.lenc * this.lenc) - (this.lenb * this.lenb))/(2 * this.lena * this.lenc));
	this.radc = (Math.PI) - (this.rada + this.radb);
    //Calculate the angle, in degrees, of each point
	this.dega = this.rada * (180 / Math.PI);
	this.degb = this.radb * (180 / Math.PI);
	this.degc = this.radc * (180 / Math.PI);
}

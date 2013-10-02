function Point(x,y) {
	this.x = x;
	this.y = y;
}

Point.prototype.add = function(pt) {
	return new Point(this.x + pt.x, this.y + pt.y);
};

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
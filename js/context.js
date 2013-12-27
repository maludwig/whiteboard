/*jshint -W117 */
/*jshint -W098 */

//Requires color.js

function Context(cv,x,y,w,h) {
	if(typeof cv === "string") {
		cv = $(cv)[0];
	} else if (typeof cv == "undefined") {
		cv = $("<canvas/>");
	}
	this.cv = cv;
	this.$cv = $(cv);
	this.pos = this.$cv.position();
	this.x = typeof x == "undefined" ? this.pos.left : x;
	this.y = typeof y == "undefined" ? this.pos.top : y;
	this.w = typeof w == "undefined" ? this.$cv.width() : w;
	this.h = typeof h == "undefined" ? this.$cv.height() : h;
	if (!this.cv.getContext){
		G_vmlCanvasManager.initElement(this.cv);
	}
	if (this.cv.getContext){
		this.ctx = this.cv.getContext('2d');
	} else {
		alert('You need canvas support to view this correctly.');
	}
}

Context.prototype.init = function () {
	$(this.cv).attr({
		width: this.w,
		height: this.h
	}).css({
		width: this.w + "px",
		height: this.h + "px"
	});
};

Context.prototype.clear = function () {
	this.ctx.clearRect(0, 0, this.cv.width, this.cv.height);
}
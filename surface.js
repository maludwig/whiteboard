/*jshint -W117 */
/*jshint -W098 */

//Requires color.js, linearalgebra-1.0.js and excanvas.js

//Make new Surface
//Options:
//{
//	canvas //The canvas to draw on
//	parent //The parent element to make a new child canvas element for
//}

function Surface(opt) {
	opt = typeof opt === "undefined" ? {} : opt;
	var cv = opt.canvas;
	if(typeof cv === "string") {
		cv = $(cv)[0];
	} else if (typeof cv === "undefined") {
		var parent = typeof opt.parent === "undefined" ? "body" : opt.parent;
		cv = $("<canvas/>").css({
			left:"0",
			top:"0",
			width:Math.max(screen.width,window.innerWidth) + "px",
			height:Math.max(screen.height,window.innerHeight) + "px",
			position:"absolute"
		}).appendTo(parent)[0];
	}
	this.cv = cv;
	this.$cv = $(cv);
	this.$cv.addClass("surface");
	var pos = this.$cv.position();
	var options = {
		x:pos.left,
		y:pos.top,
		w:this.$cv.width(),
		h:this.$cv.height(),
		tool:"pen",
		color:"#000",
		strokeWidth:3,
		offsetx:0,
		offsety:0,
		drawing:true
	};
	$.extend(options, opt);
	
	this.x = options.x;
	this.y = options.y;
	this.w = options.w;
	this.h = options.h;
	this.ox = options.offsetx;
	this.oy = options.offsety;
	$(this.cv).attr({
		width: this.w,
		height: this.h
	}).css({
		left: this.x + "px",
		top: this.y + "px",
		width: this.w + "px",
		height: this.h + "px"
	});
	if (!this.cv.getContext){
		G_vmlCanvasManager.initElement(this.cv);
	}
	if (this.cv.getContext){
		this.ctx = this.cv.getContext('2d');
		this.ctx.lineCap = 'round';
		this.color(options.color);
		this.strokeWidth(options.strokeWidth);
		this.tool(options.tool);
		this.drawing = options.drawing;
	} else {
		alert('You need canvas support to view this correctly.');
	}
}

Surface.prototype = {
	toDataURL: function() {
        if(this.cv.toDataURL) {
            return this.cv.toDataURL("image/png");
        } else {
            alert("This function is not supported in your browser");
            return false;
        }
	},
	draw: function(b) {
		if(typeof b === "undefined") {
			return this.drawing;
		} else {
			this.drawing = b;
		}
	},
	clear: function () {
		if(this.drawing) {
			this.ctx.clearRect(0, 0, this.cv.width, this.cv.height);
		}
	},
	color: function (c) {
		if(typeof c == "undefined") {
			return this.c;
		} else {
			this.c = new Color(c);
			this.c.rgba.a = this.toolOpacity();
			if(this.tool() == "eraser") {
				this.ctx.strokeStyle = "#FFF";
			} else {
				this.ctx.strokeStyle = this.c.toString();
			}
			this.ctx.fillStyle = this.ctx.strokeStyle;
		}
	},
	tool: function (tool) {
		if(typeof tool == "undefined") {
			return this.t;
		} else {
			this.t = tool;
			this.color(this.c);
		}
	},
	toolOpacity: function() {
		return this.t == "highlighter" ? 0.2 : 1;
	},
	strokeWidth: function (w) {
		if(typeof w == "undefined") {
			return this.sw;
		} else {
			this.sw = w;
			this.ctx.lineWidth = w;
		}
	},
	moveTo: function(pt,y) {
		if(this.drawing) {
			pt = typeof y == "number" ?	pt = new Point(pt,y) : pt;
			this.ctx.moveTo(pt.x-this.ox,pt.y-this.oy);
		}
	},
	lineTo: function(pt,y) {
		if(this.drawing) {
			pt = typeof y == "number" ?	pt = new Point(pt,y) : pt;
			this.ctx.lineTo(pt.x-this.ox,pt.y-this.oy);
		}
	},
	bezierCurveTo: function(pt1,pt2,pt3) {
		if(this.drawing) {
			this.ctx.bezierCurveTo(pt1.x-this.ox,pt1.y-this.oy,pt2.x-this.ox,pt2.y-this.oy,pt3.x-this.ox,pt3.y-this.oy);
		}
	},
	dot: function(pt,y) {
		if(this.drawing) {
			pt = typeof y == "number" ?	pt = new Point(pt,y) : pt;
			this.ctx.beginPath();
			this.ctx.arc(pt.x-this.ox,pt.y-this.oy,this.strokeWidth()/2,0,2*Math.PI);
			this.ctx.fill();
		}
	},
	//Draws a semicircle centred at pt1, pointing away from pt2
	semicircle: function(pt1,pt2) {
		if(this.drawing) {
			var dx = pt1.x - pt2.x;
			var dy = pt1.y - pt2.y;
			var deg = Math.atan2(dy,dx);
			this.ctx.beginPath();
			this.ctx.arc(pt1.x-this.ox,pt1.y-this.oy,this.strokeWidth()/2,(-0.5*Math.PI)+deg,(0.5*Math.PI)+deg);
			this.ctx.fill();
		}
	},
	//Resize canvas to w pixels wide by h pixels high
	resize: function(w, h){
		var temp_cnvs = document.createElement('canvas');
		var temp_cntx = temp_cnvs.getContext('2d');
		temp_cnvs.width = w; 
		temp_cnvs.height = h;
		temp_cntx.drawImage(this.cv, 0, 0);
		this.cv.width = w; 
		this.cv.height = h;
		this.ctx.drawImage(temp_cnvs, 0, 0);
	}
};
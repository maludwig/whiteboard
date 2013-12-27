
/*jshint -W098 */
/*jshint -W117 */
var $;

var hcv;
var hctx;
var pcv;
var pctx;
var h;
var w;
var drawColor;
var drawMode = "pen";
var drawLineWidth = 1;

function setColor(c) {
	c = typeof c !== 'undefined' ? c : drawColor;
	drawColor = new Color(c);
	if(drawMode == "pen") {
		drawColor.rgba.a = 1;
	} else if(drawMode == "highlighter") {
		drawColor.rgba.a = 0.3;
	} else if(drawMode == "eraser") {
		drawColor.rgba.a = 1;
	}
	hctx.strokeStyle = drawColor.toString();
	hctx.fillStyle = drawColor.toString();
	pctx.strokeStyle = drawColor.toString();
	pctx.fillStyle = drawColor.toString();
	$("#tools,#bgs,#functions").css({color:drawColor.hex});
	$(".size").css({background:drawColor.hex});
}

function drawWith(tool) {
	tool = typeof tool !== 'undefined' ? tool : drawMode;
	drawMode = tool;
	if (tool == "eraser") {
		hctx.globalCompositeOperation = "destination-out";
		pctx.globalCompositeOperation = "destination-out";
	} else if (tool == "pen" || tool == "highlighter") {
		hctx.globalCompositeOperation = "source-over";
		pctx.globalCompositeOperation = "source-over";
	}
	setColor();
	$("#tools>div").removeClass("active");
	$("#" + tool).addClass("active");
}

function lineWidth(w) {
	if (typeof w !== 'undefined') {
		drawLineWidth = w;
		hctx.lineWidth = w;
		pctx.lineWidth = w;
	} else {
		hctx.lineWidth = drawLineWidth;
		pctx.lineWidth = drawLineWidth;
		return drawLineWidth;
	}
}

function initCtx(hc,pc) {
	if(typeof hc === "string") {
		hcv = $(hc)[0];
	} else {
		hcv = hc;
	}
	if(typeof pc === "string") {
		pcv = $(pc)[0];
	} else {
		pcv = pc;
	}
	$(hcv).attr({
		width: $(hcv).width(),
		height: $(hcv).height()
	}).css({
		width: $(hcv).width() + "px",
		height: $(hcv).height() + "px"
	});
	$(pcv).attr({
		width: $(pcv).width(),
		height: $(pcv).height()
	}).css({
		width: $(pcv).width() + "px",
		height: $(pcv).height() + "px"
	});
	h = $(hcv).height();
	w = $(hcv).width();
	if (hcv.getContext){
		hctx = hcv.getContext('2d');
		pctx = pcv.getContext('2d');
		lineWidth(2);
		setColor("#1F7ABD");
		drawWith("pen");
	} else {
		alert('You need canvas support to view this correctly.');
	}
}

function simpleLine(pt1,pt2) {
	drawBoth(function(ctx) {
		ctx.beginPath();
		ctx.moveTo(pt1.x,pt1.y);
		ctx.lineTo(pt2.x,pt2.y);
		ctx.stroke();
	});
}

function dot(pt) {
	drawBoth(function(ctx) {
		ctx.beginPath();
		ctx.arc(pt.x,pt.y,lineWidth()/2,0,2*Math.PI);
		ctx.fill();
	});
}

function drawBoth(f,force) {
	if(drawMode == "highlighter" || drawMode == "eraser" || force) {
		f(hctx,hcv);
	}
	if(drawMode == "pen" || drawMode == "eraser" || force) {
		f(pctx,pcv);
	}
}

function clearDrawing() {
	drawWith("eraser");
	drawBoth(function(ctx,cv) {
		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, cv.width, cv.height);
		ctx.restore();
	});
	drawWith("pen");
	pretties = [];
}

function resize(w, h){
// create a temporary canvas obj to cache the pixel data //
    var temp_cvs = document.createElement('canvas');
    var temp_ctx = temp_cvs.getContext('2d');
// set it to the new width & height and draw the current canvas data into it // 
	drawBoth(function(ctx,cv) {
		temp_cvs.width = w; 
		temp_cvs.height = h;
		temp_ctx.drawImage(cv, 0, 0);
		// resize & clear the original canvas and copy back in the cached pixel data //
		$(cv).attr({
			width: w,
			height: h
		}).css({
			width: w + "px",
			height: h + "px"
		});
		ctx.drawImage(temp_cvs, 0, 0);
		setColor();
		drawWith();
		lineWidth();
	}, true);
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


function Color(c) {
	var result;
	if(typeof c === "string") {
		if(c.charAt(0)=="#"){
			this.hex = Color.fromShorthand(c.toLowerCase());
			this.rgba = Color.hexToRGBA(this.hex);
		} else if (c.substring(0,4) == "rgb(") {
			result = /rgb\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i.exec(c);
			this.rgba = result ? {
				r: parseFloat(result[1]),
				g: parseFloat(result[2]),
				b: parseFloat(result[3]),
				a: 1
			} : null;
			this.hex = Color.rgbaToHex(this.rgba);
		} else if (c.substring(0,4) == "rgba") {
			result = /rgba\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d*.?\d*)\s*\)/i.exec(c);
			this.rgba = result ? {
				r: parseFloat(result[1]),
				g: parseFloat(result[2]),
				b: parseFloat(result[3]),
				a: parseFloat(result[4])
			} : null;
			this.hex = Color.rgbaToHex(this.rgba);
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
Color.prototype.toString = function() {
	return "rgba(" + this.rgba.r + ", " + this.rgba.g + ", " + this.rgba.b + ", " + this.rgba.a + ")";
};

Color.serialize = function(c) {
	return c.toString();
};

Color.deserialize = function(c) {
	return new Color(c);
};
Color.fromShorthand = function(hex) {
	// Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
	var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
	return hex.replace(shorthandRegex, function(m, r, g, b) {
		return "#" + r + r + g + g + b + b;
	});

};
Color.hexToRGBA = function(hex) {
	hex = Color.fromShorthand(hex);
	var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result ? {
		r: parseInt(result[1], 16),
		g: parseInt(result[2], 16),
		b: parseInt(result[3], 16),
		a: 1
	} : null;
};
Color.rgbaToHex = function(rgba) {
	return "#" + ((1 << 24) + (rgba.r << 16) + (rgba.g << 8) + rgba.b).toString(16).slice(1);
};
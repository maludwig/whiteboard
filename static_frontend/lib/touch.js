/*jshint -W117 */
/*jshint -W098 */

//Requires color.js, hook.js, and excanvas.js
var mDown = false;

(function($){
	$(document).mousedown(function(e) {
		mDown = true;
	});
	$(document).mouseup(function(e) {
		mDown = false;
	});
	$.fn.touchStart = function(f){
		return this.each(function() {
			var h = $(this).data("touchstarthook");
			h = typeof h == "undefined" ? new Hook(this) : h;
			h(f);
			$(this).on("touchstart", function(e) {
				var x = e.originalEvent.changedTouches[0].pageX;
				var y = e.originalEvent.changedTouches[0].pageY;
				h(x,y);
				e.preventDefault();
			});
			$(this).mousedown(function(e) {
				var x = e.pageX;
				var y = e.pageY;
				h(x,y);
				e.preventDefault();
			});
			$(this).data("touchstarthook",h);
			return $(this);
		});
	};
	$.fn.touchMove = function(f){
		return this.each(function() {
			var h = $(this).data("touchmovehook");
			h = typeof h == "undefined" ? new Hook(this) : h;
			h(f);
			$(this).on("touchmove", function(e) {
				var x = e.originalEvent.changedTouches[0].pageX;
				var y = e.originalEvent.changedTouches[0].pageY;
				h(x,y);
				e.preventDefault();
			});
			$(this).mousemove(function(e) {
				if (mDown) {
					var x = e.pageX;
					var y = e.pageY;
					h(x,y);
				}
				e.preventDefault();
			});
			$(this).data("touchmovehook",h);
		});
	};
	$.fn.touchEnd = function(f) {
		return this.each(function() {
			var h = $(this).data("touchendhook");
			h = typeof h == "undefined" ? new Hook(this) : h;
			h(f);
			$(this).on("touchend", function(e) {
				var x = e.originalEvent.changedTouches[0].pageX;
				var y = e.originalEvent.changedTouches[0].pageY;
				h(x,y);
				e.preventDefault();
			});
			$(this).mouseup(function(e) {
				var x = e.pageX;
				var y = e.pageY;
				h(x,y);
				e.preventDefault();
			});
			$(this).data("touchendhook",h);
		});
	};
	
})(jQuery);// JavaScript Document
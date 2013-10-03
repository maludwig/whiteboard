/*jshint -W117 */
/*jshint -W098 */

var pretty;
var $ = jQuery;
$(window).load(function(){
	initCtx('#whiteboard');
	//drawGrid();
	/*
	$("#overlay").hammer().on("dragstart", start);
	$("#overlay").hammer().on("drag", function(e) {
		e.gesture.preventDefault();
		var x = e.gesture.center.pageX - $("#whiteboard").offset().left;
		var y = e.gesture.center.pageY - $("#whiteboard").offset().top;
		move(x,y);
	});
	$("#overlay").hammer().on("dragend",end);
	*/
	$("#overlay").hammer().on("dragstart", function() {
		start();
	});
	$("#overlay").hammer().on("drag", function(e) {
		var x = e.gesture.center.pageX - $("#whiteboard").offset().left;
		var y = e.gesture.center.pageY - $("#whiteboard").offset().top;
		move(x,y);
	});
	$("#overlay").hammer().on("dragend", function() {
		end();
	});
	$("#overlay").hammer().on("tap",tap);
	$(document).bind('touchmove', false);
});
$(function() {
	$.get("palettes.json",function(pals) {
		var pal;
		var $pal;
		var $firstpal;
		var $firstcolor;
		for(var palkey in pals) {
			pal = pals[palkey];
			$pal = $('<div class="palette" />');
			$pal.appendTo("#palettes");
			for(var colorkey in pal) {
				color = pal[colorkey];
				$color = $('<div class="palcolor" />');
				$color.css({background:"#"+color});
				$color.appendTo($pal);
				if(color === "1e77b9") {
					$firstcolor = $color;
					$firstpal = $pal;
				}
			}
		}
		$firstcolor.addClass("active");
		$(".palette").not($firstpal).hide();
		$(".palette").click(function() {
			if($(this).parent().hasClass("open")) {
				var pals = $(".palette").not(this);
				pals.hide(200);
				$("#palettes").delay(200).removeClass("open",200);
			}
		});
		$(".palcolor").click(function() {
			setColor($(this).css("backgroundColor"));
			$(".palcolor").removeClass("active");
			$(this).addClass("active");
		});
		$("#palexpand").click(function(){
			$("#palettes").addClass("open",200);
			$(".palette").delay(200).show(200);
		});
	},"json");
	$("#sideexpand").click(function(){
		$("#sidebar").toggleClass("open",200);
	});
	var sizes = [2,4,8,12,20];
	var $sz;
	var i;
	for(var key in sizes) {
		i = sizes[key];
		$sz = $('<div class="size"></div>');
		$sz.css({width:i+"px",height:i+"px",margin:(10-(i/2))+"px"});
		$("#sizes").append($sz);
	}
	sizes = [27,33,40];
	for(key in sizes) {
		i = sizes[key];
		$sz = $('<div class="size"></div>');
		$sz.css({width:i+"px",height:i+"px",margin:(20-(i/2))+"px"});
		$("#sizes").append($sz);
	}
	$(".size").click(function() {
		$(".size").removeClass("active");
		$(this).addClass("active");
		ctx.lineWidth = $(this).width();
	});
	$("#pen").click(function(){
		pen();
		$("#tools>div").removeClass("active");
		$(this).addClass("active");
	});
	$("#eraser").click(function(){
		eraser();
		$("#tools>div").removeClass("active");
		$(this).addClass("active");
	});
	$("#highlighter").click(function(){
		highlighter();
		$("#tools>div").removeClass("active");
		$(this).addClass("active");
	});
});
function log(msg) {
	msg = ('<p>' + msg + '</p>').replace(/\n/g,"<br />");
	//$("#footer").append(msg);
}
function start() {
	pretty = new Pretty();
}
function move(x,y) {
	pretty.addPoint(new Point(x,y));
}
function end() {
	pretty.endLine();
}
function tap(e) {
	var x = e.gesture.center.pageX - $("#whiteboard").offset().left;
	var y = e.gesture.center.pageY - $("#whiteboard").offset().top;
	var p = new Point(x,y);
	draw(p);
}
/*jshint -W117 */
/*jshint -W098 */

var basics=function(o){
	var sRet = "";
	for (var key in o) {
		if(!isFunction(o[key])) {
			sRet += "{" + key + ": " + o[key] + "}";
		}
	}
	return sRet;
};

var isFunction = function(obj) {
	return !!(obj && obj.constructor && obj.call && obj.apply);
};

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
		$sz = $('<div class="size extra"></div>');
		$sz.css({width:i+"px",height:i+"px",margin:(20-(i/2))+"px "+(21-(i/2))+"px"});
		$sz.hide();
		$("#sizes").append($sz);
	}
	sizes = [120];
	for(key in sizes) {
		i = sizes[key];
		$sz = $('<div class="size extra"></div>');
		$sz.css({width:i+"px",height:i+"px",margin:(60-(i/2))+"px "+(80-(i/2))+"px"});
		$sz.hide();
		$("#sizes").append($sz);
	}
	$("#sizes").append('<div style="clear:both"></div>');
	$(".size").click(function() {
		$(".size").removeClass("active");
		$(this).addClass("active");
		lineWidth($(this).width());
	});
	$("#sizeexpand").click(function(){
		$("#sizes .extra").toggle(200);
		$("#sizes").toggleClass("open");
	});
	$("#tools>div").click(function(){
		drawWith($(this).attr("id"));
	});
	$("#bgs>h3").click(function(){
		var n = $(this).html();
		$("#bgs>h3").removeClass("active");
		$(this).addClass("active");
		if(n===0) {
			$("html,body").css({background:"none"});
		} else {
			$("html,body").css({background:"url(img/bg" + $(this).html() + ".png)"});
		}
	});
	$("#clear").click(function(){
		clearDrawing();
		if(shorthash) {
			var o = {action:"clear",hash:shorthash};
			$.post("upload",o,function(data) {
				lastLineID = data.id;
			},"json");
		}
		undoMark = -1;
		undoPretties = undefined;
		$("#undo, #redo").addClass("inactive");
	});
	$("#share").click(function(){
		var o = {action:"board"};
		$.post("upload",o,function(data) {
			shorthash = data;
			window.location.hash = "#" + shorthash;
			$("#share").addClass("active");
			var ld = [];
			for(var i=0;i<pretties.length;i++) {
				ld.push(JSON.stringify(pretties[i]));
			}
			var ls = {action:"lines",hash:shorthash,linedata:JSON.stringify(ld)};
			$.post("upload",ls,function(data){
				lastLineID = data.id;
				listen();
			},"json");
			popup("Sharing",'Your whiteboard is now shared at <a href="' + window.location + '">' + window.location + '</a>');
		});
	});
	$("#ok").click(function() {
		$("#popup").hide(200);
	});
	$("#popup").center();
	$("#popup").hide();
	$(window).resize(function() {
		resize($(window).width(), $(window).height());
	});
});

$(window).load(function(){
	$("#overlay").on("touchstart", function(e) {
		var x = e.originalEvent.changedTouches[0].pageX;
		var y = e.originalEvent.changedTouches[0].pageY;
		start(x,y);
		e.preventDefault();
	});
	$("#overlay").on("touchmove", function(e) {
		var x = e.originalEvent.changedTouches[0].pageX;
		var y = e.originalEvent.changedTouches[0].pageY;
		move(x,y);
		e.preventDefault();
	});
	$("#overlay").on("touchend", function(e) {
		var x = e.originalEvent.changedTouches[0].pageX;
		var y = e.originalEvent.changedTouches[0].pageY;
		end(x,y);
		e.preventDefault();
	});
	$(document).bind('touchmove', false);
	$("#overlay").mousedown(function(e) {
		var x = e.pageX;
		var y = e.pageY;
		mDown = true;
		start(x,y);
		e.preventDefault();
	});
	$("#overlay").mousemove(function(e) {
		if (mDown) {
			var x = e.pageX;
			var y = e.pageY;
			move(x,y);
		}
		e.preventDefault();
	});
	$("#overlay").mouseup(function(e) {
		var x = e.pageX;
		var y = e.pageY;
		mDown = false;
		end(x,y);
		e.preventDefault();
	});
	
	$("*").attr("unselectable","on");
	
	$("#save").click(function() {
		var temp_cvs = document.createElement('canvas');
		var temp_ctx = temp_cvs.getContext('2d');
		temp_cvs.width = $(window).width(); 
		temp_cvs.height = $(window).height(); 
		drawBoth(function(ctx,cv) {
			temp_ctx.drawImage(cv, 0, 0);
		}, true);
		var $img = $('<img />').attr("src",temp_cvs.toDataURL("image/png")).addClass("mini");
		var $a = $("<a />").attr("href",temp_cvs.toDataURL("image/png")).attr("target","_blank");
		$a.append($img);
		$("#minis").prepend($a.clone());
		var $msg = $("<div><p>Click the image below to open it in a new window. Right-click the image to save.</p><div/>").append($a);
		popup("Save Image",$msg);
	});
});

function popup(title,msg) {
	$("#title").html(title);
	$("#message").html(msg);
	$("#popup").center();
	$("#popup").show(400);
}

function Timeout(fn, interval) {
    this.cleared = false;
	this.fn = fn;
	this.interval = interval;
	this.func = function() {
		this.cleared = true;
		this.fn();
	};
    this.id = setTimeout(this.func, this.interval);
}
Timeout.prototype.clear = function () {
	this.cleared = true;
	clearTimeout(this.id);
};
Timeout.prototype.reset = function () {
	if(!this.cleared) {
		this.clear();
	}
    this.cleared = false;
    this.id = setTimeout(this.func, this.interval);
};

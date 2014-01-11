/*jshint -W117 */
/*jshint -W098 */

var menu = {
	initialize: function() {
		//Sidebar expander
		$("#sideexpand").touchStart(function(){
			$("#sidebar").toggleClass("open",200);
		});
		//Palettes
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
			$(".palette").touchStart(function() {
				if($(this).parent().hasClass("open")) {
					var pals = $(".palette").not(this);
					pals.hide(200);
					$("#palettes").delay(200).removeClass("open",200);
				}
			});
			$(".palcolor").touchStart(function() {
				menu.setColor($(this).css("backgroundColor"));
				$(this).addClass("active");
			});
			$("#palexpand").touchStart(function(){
				$("#palettes").addClass("open",200);
				$(".palette").delay(200).show(200);
			});
		},"json");
		//Sizes
		var $szline;
		var $sz;
		var i;
		var margin;
		var sizes = [1,3,6,10,18];
		$szline = $("<div/>").appendTo("#sizes");
		for(var key in sizes) {
			i = sizes[key];
			$sz = $('<div class="size"></div>');
			$sz.css({width:i+"px",height:i+"px"});
			$szline.append($sz);
		}
		$szline.append('<div style="clear:both"></div>');
		$szline.addClass("sizeline");
		sizes = [27,33,40];
		$szline = $("<div/>").appendTo("#sizes");
		for(key in sizes) {
			i = sizes[key];
			$sz = $('<div class="size"></div>');
			margin = 20-(i/2);
			$sz.css({width:i+"px",height:i+"px"});
			$sz.data("margin",margin);
			$szline.append($sz);
		}
		$szline.append('<div style="clear:both"></div>');
		$szline.addClass("sizeline extra");
		sizes = [120];
		$szline = $("<div/>").appendTo("#sizes");
		for(key in sizes) {
			i = sizes[key];
			$sz = $('<div class="size"></div>');
			$sz.css({width:i+"px",height:i+"px"});
			$szline.append($sz);
		}
		$szline.append('<div style="clear:both"></div>');
		$szline.addClass("sizeline extra");
		menu.calcSizeMargins();
		$(".sizeline.extra").hide();
		$(".size").wrap('<span class="sizewrap"/>');
		$(".sizewrap").hover(function(){
			$(this).find(".size").addClass("hover");
			menu.setSizeMargins();
		}, function() {
			$(this).find(".size").removeClass("hover");
			menu.setSizeMargins();
		});
		$(".sizewrap").touchStart(function() {
			$(".size").removeClass("active");
			$(this).find(".size").addClass("active");
			scratch.strokeWidth($(this).find(".size").width());
			scratchFlow = newFlow();
			menu.setSizeMargins();
		});
		$(".size:first").each(function(){
			$(this).addClass("active");
			scratch.strokeWidth($(this).width());
			scratchFlow = newFlow();
			menu.setSizeMargins();
		});
		menu.setSizeMargins();
		$("#sizeexpand").touchStart(function(){
			$("#sizes .extra").toggle(200);
			$("#sizes").toggleClass("open");
		});
		//Tools
		$("#tools>div").touchStart(function(){
			menu.setTool($(this).attr("id"));
		});
		//Grids
		$("#bgs>img").touchStart(function(){
			var n = $(this).data("bg");
			$("#bgs>img").removeClass("active");
			$(this).addClass("active");
			if(n===0) {
				$("#overlay").css({background:"none"});
			} else {
				$("#overlay").css({background:"url(img/bg" + n + "a.png)"});
			}
		});
		//Functions
		$("#undo").touchStart(menu.undo);
		$("#redo").touchStart(menu.redo);
		$(window).keydown(function(e){
			if(e.which==90){
				menu.undo();
			} else if(e.which==89) {
				menu.redo();
			}
		});
		$("#clear").touchStart(function(){
			flowActions.clear();
		});
		$("#share").touchStart(function(){
			if(svr.status==ServerStatus.OFFLINE) {
				svr.online(function(){
					menu.popup("Sharing",'To share your whiteboard, simply send this link to your buddy! <br /><a href="' + location.href + '">' + location.href + "</a>");
				});
				svr.initialize();
			} else {
				menu.popup("Sharing",'To share your whiteboard, simply send this link to your buddy! <br /><a href="' + location.href + '">' + location.href + "</a>");
			}
			
		});
		$("#save").touchStart(function() {
			var pic = flowMgmt.toDataURL();
			var $img = $('<img />').attr("src",pic).addClass("mini");
			var $a = $("<a />").attr("href",pic).attr("target","_blank");
			$a.append($img);
			$("#minis").prepend($a.clone());
			var $msg = $("<div><p>Click the image below to open it in a new window. Right-click the image to save.</p><div/>").append($a);
			menu.popup("Save Image",$msg);
		});
		$("#ok").click(function() {
			$("#popup").hide(200);
		});
		$("#popup").center();
		$("#popup").hide();
		//Initialize
		menu.setTool("pen");
		menu.setColor("#1e77b9");
		$("*").attr("unselectable","on");
	},
	undo: function() {
		if(menu.isActive("#undo")) {
			flowActions.undo();
		}
	},
	redo: function() {
		if(menu.isActive("#redo")) {
			flowActions.redo();
		}
	},
	activate: function(s) {
		$(s).removeClass("inactive");
	},
	deactivate: function(s) {
		$(s).addClass("inactive");
	},
	isActive: function(s) {
		return !($(s).hasClass("inactive"));
	},
	setTool: function(t) {
		menu.tool = t;
		scratch.$cv.toggleClass("highlighting",menu.tool=="highlighter");
		scratch.color(menu.tool=="eraser" ? "#FFF": menu.color);
		scratchFlow = newFlow();
		$("#tools>div").css("color","inherit");
		$("#" + menu.tool).css("color",menu.color);
	},
	setColor: function(c) {
		menu.color = c;
		scratch.color(menu.tool=="eraser" ? "#FFF": menu.color);
		scratchFlow = newFlow();
		$(".palcolor").removeClass("active");
		$("#" + menu.tool).css("color",menu.color);
		$(".size").css("background",menu.color);
	},
	calcSizeMargins: function() {
		var borderw = 8;
		$(".sizeline").each(function(){
			var maxh = $(this).find(".size:last").height() + (borderw*2) + 4;
			var extraw = $(this).width();
			var count = 0;
			var bsub;
			var x,y;
			$(this).find(".size").each(function(){
				count++;
				extraw -= $(this).width();
			});
			x = extraw/(2*count);
			$(this).find(".size").each(function(){
				bsub = borderw;
				y = (maxh-$(this).height())/2;
				$(this).data("mgn",{top:y,right:x,bottom:y,left:x});
				$(this).data("bdrmgn",{top:y-bsub,right:x-bsub,bottom:y-bsub,left:x-bsub});
			});
		});
	},
	setSizeMargins: function() {
		var borderw = 8;
		var mgn;
		$(".size").each(function(){
			if($(this).is(".active, .hover")) {
				mgn = $(this).data("bdrmgn");
			} else {
				mgn = $(this).data("mgn");
			}
			$(this).margin(mgn);
		});
	},
	tool: "pen",
	color: "#1e77b9",
	popup: function (title,msg) {
		$("#title").html(title);
		$("#message").html(msg);
		$("#popup").center();
		$("#popup").show(400);
	}
};

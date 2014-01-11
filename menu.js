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
		var sizes = [1,3,6,10,18];
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
		$(".size").touchStart(function() {
			$(".size").removeClass("active");
			$(this).addClass("active");
			scratch.strokeWidth($(this).width());
			scratchFlow = newFlow();
		});
		$(".size:first").each(function(){
			$(this).addClass("active");
			scratch.strokeWidth($(this).width());
			scratchFlow = newFlow();
		});
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
			svr.initialize();
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
		$("#tools>div").css("color","#000");
		$("#" + menu.tool).css("color",menu.color);
	},
	setColor: function(c) {
		menu.color = c;
		scratch.color(menu.tool=="eraser" ? "#FFF": menu.color);
		scratchFlow = newFlow();
		$(".palcolor").removeClass("active");
		$("#" + menu.tool).css("color",menu.color);
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

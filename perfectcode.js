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

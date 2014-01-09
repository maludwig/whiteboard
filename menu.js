var menu = {
	initialize: function() {
		$("#undo").click(undo);
		$("#redo").click(redo);
	},
	activate: function(s) {
		$(s).removeClass("inactive");
	},
	deactivate: function(s) {
		$(s).addClass("inactive");
	}
};


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
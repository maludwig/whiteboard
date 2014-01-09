<!DOCTYPE HTML>
<html>
<head>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
	<meta name="viewport" content="user-scalable=no, width=device-width, initial-scale=1, maximum-scale=1">
	<title>Test Whiteboard</title>
	<link rel="stylesheet" type="text/css" href="style.css" />
	<script type="text/javascript" src="js/excanvas.js"></script>
	<script src="//code.jquery.com/jquery-1.9.1.js"></script>
	<script src="//code.jquery.com/ui/1.10.3/jquery-ui.js"></script>
	<script type="text/javascript" src="js/jquery-me.2.1.js"></script>
	<script type="text/javascript" src="js/surface.js"></script>
	<script type="text/javascript" src="js/flow.js"></script>
	<script type="text/javascript" src="js/color.js"></script>
	<script type="text/javascript" src="js/hook.js"></script>
	<script type="text/javascript" src="js/touch.js"></script>
	<script type="text/javascript" src="js/linearalgebra-1.2.js"></script>
	<script>
		var scratch;
		var scratchFlow;
		var lastt;
		var flows = [];
		$(function(){
			hiddensurface = new Surface({drawing:false});
			scratch = new Surface({canvas:"#scratch",strokeWidth:1,color:"#C42169"});
			$("#overlay").touchStart(testLines);
			$("#overlay").touchMove(testLines);
			$("#overlay").touchEnd(testLines);
		});
		testLines = function(w,z) {
			var x,y;
			for(var i=0;i<5;i++) {
				x=w;
				y=z;
				scratchFlow = new Flow({
					surface:scratch,
					color:$.rcolor(undefined,undefined,"FF"),
					strokeWidth:$.rand(1,9),
					tool:$.rand(['pen','highlighter','eraser'])
				});
				for(var k=0;k<20;k++) {
					x += $.rand(-30,30);
					y += $.rand(-30,30);
					scratchFlow.point(x,y);
				}
				//Flow.deserialize(Flow.serialize(scratchFlow));
			}
		}
	</script>
</head>

<body>
	<div id="log"></div>
	<div id="overlay"></div>
	<div id="lines"></div>
	<canvas id="historic"></canvas>
	<canvas id="modern"></canvas>
	<canvas id="scratch"></canvas>
</body>
</html>
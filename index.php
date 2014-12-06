<!DOCTYPE HTML>
<html>
<head>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
	<meta name="viewport" content="initial-scale=0.6">
	<title>Mitchell's Whiteboard</title>
	<link href="css/style.css" rel="stylesheet" type="text/css" />
	<link rel="stylesheet" href="//netdna.bootstrapcdn.com/font-awesome/3.2.1/css/font-awesome.css">
	<!--[if IE 7]>
	  <link rel="stylesheet" href="//netdna.bootstrapcdn.com/font-awesome/3.2.1/css/font-awesome-ie7.css">
	<![endif]-->
	<link href='http://fonts.googleapis.com/css?family=Julius+Sans+One' rel='stylesheet' type='text/css'>
	<link href='http://fonts.googleapis.com/css?family=Varela' rel='stylesheet' type='text/css'>
	<!--[if IE 8]>
        <script type="text/javascript" src="lib/excanvas.js"></script>
    <![endif]-->
	<script src="//code.jquery.com/jquery-1.9.1.js"></script>
	<script src="//code.jquery.com/ui/1.10.3/jquery-ui.js"></script>
	<script type="text/javascript" src="lib/jquery-me.2.2.js"></script>
	<script type="text/javascript" src="lib/json3.min.js"></script>
	<script type="text/javascript" src="lib/color.js"></script>
	<script type="text/javascript" src="lib/hook.js"></script>
	<script type="text/javascript" src="lib/touch.js"></script>
	<script type="text/javascript" src="lib/linearalgebra-1.3.js"></script>
	<script type="text/javascript" src="lib/jquery-center.1.2.js"></script>
	<script type="text/javascript" src="js/menu.js"></script>
	<script type="text/javascript" src="js/surface.js"></script>
	<script type="text/javascript" src="js/flow.js"></script>
	<script type="text/javascript" src="js/flowmgmt.js"></script>
	<script type="text/javascript" src="js/server.js"></script>
	<style>
	</style>
	<script>
        var lasthash = "";
		function log(x) {
            //$("#log").prepend(x)
        };
		$(function(){
			flowMgmt.initialize();
			flowActions.initialize();
			menu.initialize();
			svr.online(function() {
				svr.uploadFlows(flows);
				location.hash = svr.hash;
                lasthash = location.hash;
			});
            setInterval( function() {
                if(location.hash !== lasthash) {
                    flowMgmt.clear();
                    svr.initialize(location.hash);
                    lasthash = location.hash;
                }
            },500);
		});
	</script>
</head>
<body>
	<div id="sidebar" class="open">
		<div id="sideexpand"><i class="icon-angle-right"></i><i class="icon-angle-left"></i></div>
		<div id="palettes">
			<div id="palexpand"><i class="icon-angle-right"></i><i class="icon-angle-left"></i></div>
		</div>
		<hr />
		<div id="sizes">
			<div id="sizeexpand"><i class="icon-angle-right"></i><i class="icon-angle-left"></i></div>
		</div>
		<hr />
		<div id="tools">
			<div id="pen" class="active"><i class="icon-pencil"></i><p>Pen</p></div>
			<div id="highlighter"><i class="icon-sun"></i><p>Highlighter</p></div>
			<div id="eraser"><i class="icon-eraser"></i><p>Eraser</p></div>
		</div>
		<hr />
		<div id="bgs">
			<img src="img/bg0icon.png" data-bg="0">
			<img src="img/bg1icon.png" data-bg="1">
			<img src="img/bg2icon.png" data-bg="2">
			<img src="img/bg3icon.png" data-bg="3" class="active">
			<img src="img/bg4icon.png" data-bg="4">
		</div>
		<hr />
		<div id="functions">
				<div id="clear"><i class="icon-star-empty"></i><p>Clear</p></div>
				<div id="share"><i class="icon-cloud"></i><p>Share</p></div>
				<div id="save"><i class="icon-save"></i><p>Save</p></div>
				<div id="undo" class="inactive"><i class="icon-mail-reply"></i><p>Undo</p></div>
				<div id="redo" class="inactive"><i class="icon-mail-forward"></i><p>Redo</p></div>
		</div>
		<hr />
        <p class="copyright">
            Designed, implemented, and hosted by Mitchell Ludwig. Copyright 2014 by Mitchell Ludwig.
        </p>
		<hr />
        <div id="minis"></div>
	</div>
	<div id="log"></div>
	<div id="overlay"></div>
	<div id="lines"></div>
	<canvas id="historic"></canvas>
	<canvas id="modern"></canvas>
	<canvas id="scratch"></canvas>
	<div id="popup">
		<h3 id="title"></h3>
		<div id="message"></div>
		<button id="ok">OK</button>
	</div>
</body>
</html>
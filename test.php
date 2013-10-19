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
	<script type="text/javascript" src="server.js"></script>
	<script>
		var svr = new Server(window.location.hash);
		$(function(){
			$("button:contains('New Board')").click(function(){
				alert("new board");
			});
		});
	</script>
</head>

<body>
	<div id="log"></div>
	<button>New Board</button>
	<button>New Line</button>
	<button>New Lines</button>
	<button>Clear</button>
	<button>Undo Last</button>
	<button>Get Lines</button>
</body>
</html>
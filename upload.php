<?php
require_once "sqliboard.php";
if(noneEmpty('action')) {
	if($_REQUEST['action'] == "board") {
		$brd = new Board();
		echo $brd->shorthash;
	} else if($_REQUEST['action'] == "line") {
		$lastid = 0;
		if(noneEmpty("linedata","hash")) {
			$brd = new Board($_REQUEST['hash']);
			$lastid = $brd->addLine($_REQUEST['linedata']);
			echo json_encode(['id' => $lastid]);
		}
	} else if($_REQUEST['action'] == "lines") {
		$lastid = 0;
		if(noneEmpty("linedata","hash")) {
			$brd = new Board($_REQUEST['hash']);
			$lines = json_decode($_REQUEST['linedata']);
			foreach($lines as $key => $val) {
				$lastid = $brd->addLine($val);
			}
			echo json_encode(['id' => $lastid]);
		}
	} else if($_REQUEST['action'] == "clear") {
		$lastid = 0;
		if(noneEmpty("hash")) {
			$brd = new Board($_REQUEST['hash']);
			echo json_encode(['id' => $brd->clear()]);
		}
	} else if($_REQUEST['action'] == "getlines") {
		if(allSet("hash","since")) {
			$brd = new Board($_REQUEST['hash']);
			echo json_encode($brd->getLines($_REQUEST['since']));
		}
	}
} else {
	echo "Malformed request";
}


function allSet() {
	$args = func_get_args();
	foreach($args as $mixed) {
		if (is_array($mixed)) {
			foreach($mixed as $val) {
				if(!isset($_REQUEST[$val])) {
					return false;
				}
			}
		} else {
			if(!isset($_REQUEST[$mixed])) {
				return false;
			}
		}
	}
	return true;
}

function noneEmpty() {
	$args = func_get_args();
	foreach($args as $mixed) {
		if (is_array($mixed)) {
			foreach($mixed as $val) {
				if(empty($_REQUEST[$val])) {
					return false;
				}
			}
		} else {
			if(empty($_REQUEST[$mixed])) {
				return false;
			}
		}
	}
	return true;
}

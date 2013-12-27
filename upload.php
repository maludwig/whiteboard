<?php
require_once "sqliboard.php";
if(noneEmpty('action')) {
	if($_REQUEST['action'] == "new") {
		$brd = new Board();
		reply(0,["hash" => $brd->shorthash,"clientid" => $brd->nextClient()]);
	} else if(noneEmpty("hash")) {
		if($_REQUEST['action'] == "init") {
			$brd = new Board($_REQUEST['hash']);
			reply(0,["hash" => $brd->shorthash,"clientid" => $brd->nextClient()]);
		} else if($_REQUEST['action'] == "lines") {
			if(noneEmpty("linedata")) {
				$brd = new Board($_REQUEST['hash']);
				$lines = json_decode($_REQUEST['linedata'], true);
				foreach($lines as $key => $line) {
					$idsp[] = $brd->addLine($line);
				}
				reply(end($idsp),$idsp);
			}
		} else if($_REQUEST['action'] == "clear") {
			$lastid = 0;
			$brd = new Board($_REQUEST['hash']);
			reply($brd->clear());
		} else if($_REQUEST['action'] == "undo") {
			$lastid = 0;
			if(noneEmpty("code")) {
				$brd = new Board($_REQUEST['hash']);
				reply($brd->remove($_REQUEST['code']));
			}
		} else if($_REQUEST['action'] == "getlines") {
			if(allSet("since")) {
				$brd = new Board($_REQUEST['hash']);
				$lines = $brd->getLines($_REQUEST['since']);
				reply($lines->id, $lines->jsons);
			}
		}
	}
} else {
	echo "Malformed request";
}

function reply($since,$data = "") {
	$out = [];
	$out['since'] = $since;
	$out['data'] = $data;
	echo json_encode($out);
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

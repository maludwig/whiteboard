<?php
/*
if(rand(0,200)>198){
	header('HTTP/1.1 500 Internal Server Error');
	exit("Do you even lift?");
}
if(rand(0,200)>198){
	header("HTTP/1.0 404 Not Found");
	exit("Gone to the beach");
}
*/
usleep(rand(0,3000000));
require_once "sqliboard.php";
if(noneEmpty('action')) {
	if($_REQUEST['action'] == "new") {
		$brd = new Board();
		reply(0,["hash" => $brd->shorthash,"clientid" => $brd->nextClient()]);
	} else if(noneEmpty("hash")) {
		$brd = new Board($_REQUEST['hash']);
		if($_REQUEST['action'] == "init") {
			reply(0,["hash" => $brd->shorthash,"clientid" => $brd->nextClient()]);
		} else if(noneEmpty("client")){
			$client = $_REQUEST['client'];
			if($_REQUEST['action'] == "lines") {
				if(noneEmpty("linedata")) {
					$lines = json_decode($_REQUEST['linedata'], true);
					foreach($lines as $key => $line) {
						$idsp[] = $brd->addRow($client,$line['code'],"flow",json_encode($line['flow']));
					}
					reply(0);
				}
			} else if($_REQUEST['action'] == "clear") {
				reply($brd->clear($client));
			} else if($_REQUEST['action'] == "undo") {
				if(noneEmpty("code")) {
					$brd->remove($client,$_REQUEST['code']);
					reply();
				}
			} else if($_REQUEST['action'] == "getlines") {
				if(allSet("since")) {
					$lines = $brd->getLines($client,$_REQUEST['since']);
					reply($lines['id'], $lines['jsons']);
				}
			}
		}
	}
} else {
	echo "Malformed request";
}

function reply($since = 0,$data = "") {
	echo json_encode(["since" => $since, "data" => $data]);
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

<?php
require_once "sqliboard.php";
Board::insert();
exit();
if(noneEmpty('action','hash')) {
	echo $_REQUEST['action'];
} else {
	echo "Malformed request";
}



		
function getBoardID($shorthash) {
	$shorthash = str_pad($shorthash,8,"0");
	//Using the global $mysqli connection
	$mysqli = $GLOBALS['mysqli'];
	$query = "SELECT id FROM boards WHERE shorthash=0x" . $mysqli->real_escape_string(shorthash);
	$result = $mysqli->query($query);
	if (!$result) {
		throw new Exception($mysqli->error);
	}
	if ($result->num_rows > 0) {
		$row = $result->fetch_assoc();
		return $row['id'];
	} else {
		throw new Exception('User not found');
	}
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
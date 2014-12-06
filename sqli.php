<?php

	//If we have not yet created the $mysqli object
	if(!isset($GLOBALS['mysqli'])) {
		$GLOBALS['mysqli'] = new mysqli("localhost", "whiteboard", "URsVr5PDAQYxpfuc","whiteboard");
		//If we couldn't connect, then die (ends execution) and print the error
		if ($GLOBALS['mysqli']->connect_error) {
			die('Connect Error [' . $GLOBALS['mysqli']->connect_errno . '] ' . $GLOBALS['mysqli']->connect_error);
		}
	}
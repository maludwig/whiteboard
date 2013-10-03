<?php

	//If we have not yet created the $mysqli object
	if(!isset($GLOBALS['mysqli'])) {
		//Make a new MySQLi object that connects to the local computer, with the username 'cpsc471'
		//	and the password "ps3xy6NGwHTQj4Xm", and connects to the database "cpsc471"
		$GLOBALS['mysqli'] = new mysqli("localhost", "whiteboard", "URsVr5PDAQYxpfuc","whiteboard");
		//If we couldn't connect, then die (ends execution) and print the error
		if ($GLOBALS['mysqli']->connect_error) {
			die('Connect Error [' . $GLOBALS['mysqli']->connect_errno . '] ' . $GLOBALS['mysqli']->connect_error);
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
		
		/* Inserts a row into a table
			$tablename = A string containing the name of the table
			$columns = An array containing the names of the columns to insert into
			$values = An array of values to insert
		*/
		function insertRow($tablename, $columns, $values) {
			//Using the global $mysqli connection
			$mysqli = $GLOBALS['mysqli'];
			//Build a query
			$query = "INSERT INTO " . $tablename;
			$query .= " (`" . implode("`,`", $columns) . "`)";
			$query .= " VALUES (";
			foreach($values as $key => $val) {
				$query .= "'" . $mysqli->real_escape_string(decodeentities($val)) . "',";
			}
			$query = substr($query,0,strlen($query)-1);
			$query .= ")";
			//Query the database to insert the row
			$res = $mysqli->query($query);
			//Report errors as they occur
			if (!($res)) {
				print("<br />Error:" . $mysqli->error);
			}
			//print("<p>$query</p>");
		}
		
		function decodeentities($str) {
			return html_entity_decode(preg_replace_callback("/(&#[0-9]+;)/", function($m) { return mb_convert_encoding($m[1], "UTF-8", "HTML-ENTITIES"); }, $str));
		}
		
		function generateQuery($vals) {
			foreach($vals as $key => $val) {
				$sqlkeys[] = $key;
				if(is_string($val)) {
					$sqlvals[] = "'" . $mysqli->real_escape_string($val) . "'";
				} else {
					$sqlvals[] = $mysqli->real_escape_string($val);
				}
			}
			return ["keys" => $sqlkeys, "vals" => $sqlvals];
		}
	}
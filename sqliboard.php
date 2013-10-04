<?php
require_once "sqli.php";

class Board {
	// property declaration
	public $id;
	public $hash;
	public $shorthash;
	public $line;
	public $pointCount;
	
	public function getLines($since = "") {
		//Using the global $mysqli connection
		$mysqli = $GLOBALS['mysqli'];
		$query = "SELECT * FROM `lines` WHERE board=" . $mysqli->real_escape_string($this->id);
		if(!empty($since) && is_numeric($since)) {
			$query .= " AND id > " .  $mysqli->real_escape_string($since);
		}
		$maxid = $since;
		$result = $mysqli->query($query);
		if (!$result) {
			throw new Exception($mysqli->error);
		}
		if ($result->num_rows > 0) {
			while ($row = $result->fetch_assoc()) {
				$maxid = max($maxid,$row['id']);
				$jsons[] = $row['json'];
			}
			return ["id" => $maxid, "jsons" => $jsons];
		} else {
			return ["id" => $maxid, "jsons" => []];
		}
	}
	
	public function addLine($json) {
		//Using the global $mysqli connection
		$mysqli = $GLOBALS['mysqli'];
		$query = "INSERT INTO `lines` (board,json) VALUES (" . $mysqli->real_escape_string($this->id) . ",'" . $mysqli->real_escape_string($json) . "')";
		$result = $mysqli->query($query);
		if (!$result) {
			throw new Exception($mysqli->error);
		}
		$this->line = $mysqli->insert_id;
		$this->pointCount = 0;
		return $this->line;
	}
	
	public function get($attr = "") {
		//Using the global $mysqli connection
		$mysqli = $GLOBALS['mysqli'];
		$query = "SELECT * FROM boards WHERE id=" . $mysqli->real_escape_string($this->id);
		$result = $mysqli->query($query);
		if (!$result) {
			throw new Exception($mysqli->error);
		}
		if ($result->num_rows > 0) {
			$row = $result->fetch_assoc();
			if ($attr == "") {
				return $row;
			} else {
				return $row[$attr];
			}
		} else {
			throw new Exception('Board not found');
		}
	}
	
	function __construct($shorthash = "",$checkExistence = true) {
		if($shorthash === "") {
			//Using the global $mysqli connection
			$mysqli = $GLOBALS['mysqli'];
			do {
				$hash = substr(md5(microtime()),0,8);
				$shorthash = str_pad(substr($hash,0,2),"0");
				if(Board::exists($shorthash)) {
					$shorthash = str_pad(substr($hash,0,4),"0");
					if(Board::exists($shorthash)) {
						$shorthash = str_pad(substr($hash,0,6),"0");
						if(Board::exists($shorthash)) {
							$shorthash = $hash;
						}
					}
				}
			} while(Board::exists($hash));
			$query = "INSERT INTO boards (shorthash,hash) VALUES (0x$shorthash, 0x$hash)";
			$result = $mysqli->query($query);
			if (!$result) {
				throw new Exception($mysqli->error);
			}
			$this->id = $mysqli->insert_id;
			$this->hash = $hash;
			$this->shorthash = $shorthash;
		} else {
			if(!ctype_xdigit($shorthash)){
				throw new Exception("Non-hex shorthash");
			}
			if($checkExistence) {
				if(!$this->exists($shorthash)) {
					throw new ExistenceException('Board does not exist');
				}
			}
			$this->populate($shorthash);
		}
	}
	
    public function __toString() {
		return $this->id . "|" . $this->hash . "|" . $this->shorthash . "a";
    }
	
	public static function exists($shorthash) {
		$mysqli = $GLOBALS['mysqli'];
		if(!ctype_xdigit($shorthash)){
			throw new Exception("non-hex id");
		}
		$shorthash = str_pad($shorthash,8,"0");
		$query = "SELECT * FROM boards WHERE shorthash=0x" . $shorthash;
		$result = $mysqli->query($query);
		if (!$result) {
			throw new Exception($mysqli->error);
		}
		if ($result->num_rows > 0) {
			return true;
		} else {
			return false;
		}
	}
	
	public function populate($shorthash) {
		$mysqli = $GLOBALS['mysqli'];
		if(!ctype_xdigit($shorthash)){
			throw new Exception("Non-hex id");
		}
		$shorthash = str_pad($shorthash,8,"0");
		$query = "SELECT id,HEX(hash) as hash,HEX(shorthash) as sh FROM boards WHERE shorthash=0x" . $shorthash;
		$result = $mysqli->query($query);
		if (!$result) {
			throw new Exception($mysqli->error);
		}
		if ($result->num_rows > 0) {
			$row = $result->fetch_assoc();
			$this->id = $row['id'];
			$this->hash = $row['hash'];
			$this->shorthash = $shorthash;
		} else {
			throw new Exception("No rows found");
		}
	}
}
<?php
require_once "sqli.php";

class Board {
	// property declaration
	public $id;
	public $hash;
	public $shorthash;
	public $line;
	public $pointCount;
	
	public function clear() {
		//Using the global $mysqli connection
		$mysqli = $GLOBALS['mysqli'];
		$query = "DELETE FROM `lines` WHERE board=" . $mysqli->real_escape_string($this->id);
		$result = $mysqli->query($query);
		if (!$result) {
			throw new Exception($mysqli->error);
		}
		return $this->addRow("clear",0);
	}
	
	public function remove($code) {
		//Using the global $mysqli connection
		if(!is_numeric($code)) {
			throw new Exception("Non-numeric code");
		}
		$mysqli = $GLOBALS['mysqli'];
		$query = "DELETE FROM `lines` WHERE board=" . $mysqli->real_escape_string($this->id);
		$query .= " AND code=" . $code . ' ORDER BY id DESC LIMIT 1';
		$result = $mysqli->query($query);
		if (!$result) {
			throw new Exception($mysqli->error);
		}
		return $this->addRow('undo',$code);
	}
	
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
				if($row['json'] == "clear") {
					$json = ["type" => "clear"];
				} else if($row['json'] == "undo") {
					$json = ["type" => "undo"];
				} else {
					$json = json_decode($row['json'],true);
					$json['type'] = 'line';
				}
				$json['id'] = $row['id'];
				$json['code'] = $row['code'];
				$jsons[] = $json;
			}
			return ["id" => $maxid, "jsons" => $jsons];
		} else {
			return ["id" => $maxid, "jsons" => []];
		}
	}
	
	public function addLine($line) {
		return $this->addRow(json_encode($line),$line['code']);
	}
	
	public function addRow($json,$code) {
		$mysqli = $GLOBALS['mysqli'];
		$query = "INSERT INTO `lines` (board,code,json) VALUES (" . $mysqli->real_escape_string($this->id) . "," . $mysqli->real_escape_string($code) . ",'" . $mysqli->real_escape_string($json) . "')";
		$result = $mysqli->query($query);
		if (!$result) {
			throw new Exception($mysqli->error);
		}
		$this->line = $mysqli->insert_id;
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
			$shorthash = str_pad($shorthash,8,"0");
			$this->shorthash = $shorthash;
		} else {
			if(!ctype_xdigit($shorthash)){
				throw new Exception("Non-hex shorthash");
			}
			if($checkExistence) {
				if(!$this->exists($shorthash)) {
					throw new Exception('Board does not exist');
				}
			}
			$shorthash = str_pad($shorthash,8,"0");
			$this->shorthash = $shorthash;
			$this->populate();
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
	
	public function populate($shorthash = "") {
		if ($shorthash === "") {
			$shorthash = $this->shorthash;
		}
		$mysqli = $GLOBALS['mysqli'];
		if(!ctype_xdigit($shorthash)){
			throw new Exception("Non-hex id");
		}
		$shorthash = str_pad($shorthash,8,"0");
		$this->shorthash = $shorthash;
		$query = "SELECT id,HEX(hash) as hash,HEX(shorthash) as sh FROM boards WHERE shorthash=0x" . $shorthash;
		$result = $mysqli->query($query);
		if (!$result) {
			throw new Exception($mysqli->error);
		}
		if ($result->num_rows > 0) {
			$row = $result->fetch_assoc();
			$this->id = $row['id'];
			$this->hash = $row['hash'];
		} else {
			throw new Exception("No rows found");
		}
	}
	
	public function nextClient() {
		$mysqli = $GLOBALS['mysqli'];
		$query = "UPDATE boards SET clients = MOD(clients + 1, 256) WHERE shorthash=0x" . $this->shorthash;
		$result = $mysqli->query($query);
		if (!$result) {
			throw new Exception($mysqli->error);
		}
		$query = "SELECT clients FROM boards WHERE shorthash=0x" . $this->shorthash;
		$result = $mysqli->query($query);
		if (!$result) {
			throw new Exception($mysqli->error);
		}
		if ($result->num_rows > 0) {
			$row = $result->fetch_assoc();
			$lastclient = $row['clients'];
		} else {
			throw new Exception("No rows found. Query: " . $query);
		}
		return $lastclient;
	}
}

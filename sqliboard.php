<?php
require_once "sqli.php";

class Board {
	// property declaration
	public $id;
	public $hash;
	public $shorthash;
	public $line;
	public $pointCount;
	
	public function clear($client) {
		if(!is_numeric($client)) {
			throw new Exception("Non-numeric client");
		}
		//Using the global $mysqli connection
		$mysqli = $GLOBALS['mysqli'];
		$query = "DELETE FROM `lines` WHERE board=" . $mysqli->real_escape_string($this->id);
		$result = $mysqli->query($query);
		if (!$result) {
			throw new Exception($mysqli->error);
		}
		return $this->addRow($client,0,"clear");
	}
	
	public function remove($client,$code) {
		if(!is_numeric($client)) {
			throw new Exception("Non-numeric client");
		}
		if(!is_numeric($code)) {
			throw new Exception("Non-numeric code");
		}
		//Using the global $mysqli connection
		$mysqli = $GLOBALS['mysqli'];
		$query = "DELETE FROM `lines` WHERE board=" . $mysqli->real_escape_string($this->id);
		$query .= " AND client=" . $client . " AND code=" . $code . ' ORDER BY id DESC LIMIT 1';
		$result = $mysqli->query($query);
		if (!$result) {
			throw new Exception($mysqli->error);
		}
		return $this->addRow($client,$code,"undo");
	}
	
	public function getLines($since = "") {
		//Using the global $mysqli connection
		$mysqli = $GLOBALS['mysqli'];
		$query = "SELECT * FROM `lines` WHERE board=" . $mysqli->real_escape_string($this->id);
		if(!empty($since) && is_numeric($since)) {
			$query .= " AND id > " .  $since;
		}
		$maxid = $since;
		$result = $mysqli->query($query);
		if (!$result) {
			throw new Exception($mysqli->error);
		}
		if ($result->num_rows > 0) {
			while ($row = $result->fetch_assoc()) {
				$maxid = max($maxid,$row['id']);
				$json = ['type'=>$row['type'], 'data'=>$row['json'], 'client'=>$row['client'], 'code'=>$row['code']];
				$jsons[] = $json;
			}
			return ["id" => $maxid, "jsons" => $jsons];
		} else {
			return ["id" => $maxid, "jsons" => []];
		}
	}
	
	public function addRow($client,$code,$type,$json = "") {
		if(!is_numeric($client)) {
			throw new Exception("Non-numeric client");
		}
		if(!is_numeric($code)) {
			throw new Exception("Non-numeric code");
		}
		$mysqli = $GLOBALS['mysqli'];
		$query = "INSERT INTO `lines` (board,client,code,type,json) VALUES (" . $mysqli->real_escape_string($this->id) . "," . $client . "," . $code . ",'" . $mysqli->real_escape_string($type) . "','" . $mysqli->real_escape_string($json) . "')";
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
		$shorthash = str_pad($this->shorthash,8,"0");
		$query = "UPDATE boards SET clients = MOD(clients + 1, 256) WHERE shorthash=0x" . $shorthash;
		$result = $mysqli->query($query);
		if (!$result) {
			throw new Exception($mysqli->error);
		}
		$query = "SELECT clients FROM boards WHERE shorthash=0x" . $shorthash;
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

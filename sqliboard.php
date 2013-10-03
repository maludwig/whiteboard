<?php
require_once "sqli.php";

class Board
{
	// property declaration
	public $id;
	public $hash;
	public $shorthash;
	
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
			echo $query;
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
			if($checkexistence) {
				if(!$this->exists($shorthash)) {
					throw new ExistenceException('Board does not exist');
				}
			}
			$this->populate($shorthash);
		}
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
		$query = "SELECT * FROM boards WHERE shorthash=0x" . $shorthash;
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
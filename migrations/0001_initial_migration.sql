-- Baseline schema, matching the production whiteboard database as of 2026-10-25
-- (MariaDB 10.11). IF NOT EXISTS lets this be applied to the existing production
-- database to mark it as migrated without touching its data.

CREATE TABLE IF NOT EXISTS `boards` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `hash` binary(4) NOT NULL,
  `shorthash` binary(4) NOT NULL,
  `clients` tinyint(3) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE IF NOT EXISTS `lines` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `board` int(11) NOT NULL,
  `client` tinyint(3) unsigned NOT NULL,
  `code` smallint(5) unsigned NOT NULL,
  `type` enum('undo','clear','flow') NOT NULL,
  `json` mediumtext NOT NULL,
  PRIMARY KEY (`id`),
  KEY `board` (`board`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

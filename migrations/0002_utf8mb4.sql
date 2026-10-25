-- Convert both tables from latin1 to utf8mb4. As of 2026-10-25 every lines.json
-- row is pure ASCII, so the conversion leaves the stored bytes unchanged.
-- CONVERT TO would widen json to longtext to keep its character capacity;
-- the MODIFY keeps it mediumtext (16 MB), far above the largest stroke.

ALTER TABLE `boards` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `lines`
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  MODIFY `json` mediumtext NOT NULL;

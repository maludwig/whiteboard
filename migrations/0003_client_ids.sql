-- Client ids become random 32-bit numbers, handed out by the server, instead of
-- a per-board counter that wrapped at 256 and so reused ids on busy boards.
-- With them, (board, client, code) names one write, which makes retried writes
-- detectable; the new index serves that check. boards.clients (the old counter)
-- is no longer used.
--
-- Also indexes boards.shorthash, which every join looks a board up by.

ALTER TABLE `lines`
  MODIFY `client` int(10) unsigned NOT NULL,
  ADD KEY `board_client_code` (`board`, `client`, `code`);
ALTER TABLE `boards` ADD KEY `shorthash` (`shorthash`);

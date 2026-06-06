-- Run once on production: mysql dior_billing < deploy/sql/add_last_online_at.sql

ALTER TABLE `users`
  ADD COLUMN `last_online_at` DATETIME(3) NULL AFTER `last_login_ip`;

CREATE INDEX `users_last_online_at_idx` ON `users`(`last_online_at`);

UPDATE `users`
SET `last_online_at` = `last_login_at`
WHERE `last_online_at` IS NULL AND `last_login_at` IS NOT NULL;

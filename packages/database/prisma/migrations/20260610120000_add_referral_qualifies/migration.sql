-- Referral counts only users who got a referrer at first signup (not legacy accounts).
ALTER TABLE `users` ADD COLUMN `referral_qualifies` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `users_referral_qualifies_idx` ON `users`(`referral_qualifies`);

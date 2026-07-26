-- Amper DNS attachment for domain management + SSL
ALTER TABLE `domains` ADD COLUMN `amper_dns_id` VARCHAR(191) NULL;
ALTER TABLE `domains` ADD COLUMN `dns_managed` BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX `domains_amper_dns_id_idx` ON `domains`(`amper_dns_id`);

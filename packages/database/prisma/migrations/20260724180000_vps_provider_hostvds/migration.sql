-- Multi-provider VPS: Proxmox (bulletproof) + HostVDS/OpenStack (standard)
ALTER TABLE `vps_instances` ADD COLUMN `provider` VARCHAR(191) NOT NULL DEFAULT 'proxmox';
ALTER TABLE `vps_instances` ADD COLUMN `external_id` VARCHAR(191) NULL;
CREATE INDEX `vps_instances_provider_idx` ON `vps_instances`(`provider`);
CREATE INDEX `vps_instances_external_id_idx` ON `vps_instances`(`external_id`);

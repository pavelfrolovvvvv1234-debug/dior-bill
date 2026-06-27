-- Shared IPv4 registry for Telegram bot + web billing (same MySQL database).
CREATE TABLE `network_ip_allocations` (
    `id` VARCHAR(191) NOT NULL,
    `ip` VARCHAR(45) NOT NULL,
    `network` VARCHAR(50) NOT NULL,
    `owner` VARCHAR(32) NOT NULL,
    `status` VARCHAR(16) NOT NULL,
    `vmid` INTEGER NULL,
    `vps_id` VARCHAR(191) NULL,
    `external_service_id` VARCHAR(191) NULL,
    `hostname` VARCHAR(255) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `released_at` DATETIME(3) NULL,

    UNIQUE INDEX `network_ip_allocations_ip_key`(`ip`),
    INDEX `network_ip_allocations_network_status_idx`(`network`, `status`),
    INDEX `network_ip_allocations_status_idx`(`status`),
    INDEX `network_ip_allocations_vps_id_idx`(`vps_id`),
    INDEX `network_ip_allocations_external_service_id_idx`(`external_service_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

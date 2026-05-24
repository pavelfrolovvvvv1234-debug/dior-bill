-- CreateTable
CREATE TABLE `promo_code_redemptions` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `promo_code_id` VARCHAR(191) NOT NULL,
    `credit` DECIMAL(12, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `promo_code_redemptions_user_id_promo_code_id_key`(`user_id`, `promo_code_id`),
    INDEX `promo_code_redemptions_promo_code_id_idx`(`promo_code_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `promo_code_redemptions` ADD CONSTRAINT `promo_code_redemptions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `promo_code_redemptions` ADD CONSTRAINT `promo_code_redemptions_promo_code_id_fkey` FOREIGN KEY (`promo_code_id`) REFERENCES `promo_codes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

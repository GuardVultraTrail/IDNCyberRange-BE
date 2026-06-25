-- DropIndex
DROP INDEX `submissions_userId_labId_kind_key` ON `submissions`;

-- AlterTable
ALTER TABLE `labs` DROP COLUMN `rootFlag`,
    DROP COLUMN `userFlag`,
    ADD COLUMN `guidedEnabled` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `submissions` DROP COLUMN `kind`,
    ADD COLUMN `flagId` INTEGER NOT NULL;

-- CreateTable
CREATE TABLE `lab_flags` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `labId` INTEGER NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `points` INTEGER NOT NULL DEFAULT 50,
    `order` INTEGER NOT NULL DEFAULT 0,

    INDEX `lab_flags_labId_idx`(`labId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `submissions_userId_flagId_key` ON `submissions`(`userId`, `flagId`);

-- AddForeignKey
ALTER TABLE `lab_flags` ADD CONSTRAINT `lab_flags_labId_fkey` FOREIGN KEY (`labId`) REFERENCES `labs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submissions` ADD CONSTRAINT `submissions_flagId_fkey` FOREIGN KEY (`flagId`) REFERENCES `lab_flags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

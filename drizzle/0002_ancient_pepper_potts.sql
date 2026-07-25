ALTER TABLE `expenses` ADD `chargedToUserId` int;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_chargedToUserId_users_id_fk` FOREIGN KEY (`chargedToUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `expenses_charged_to_idx` ON `expenses` (`chargedToUserId`);
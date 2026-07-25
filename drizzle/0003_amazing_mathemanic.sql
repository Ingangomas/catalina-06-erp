CREATE TABLE `expense_change_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`expenseId` int NOT NULL,
	`changedByUserId` int NOT NULL,
	`action` enum('created','updated','ai_extracted','submitted','reviewed') NOT NULL,
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `expense_change_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `expense_grid_styles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`targetType` enum('row','column') NOT NULL,
	`targetKey` varchar(64) NOT NULL,
	`backgroundColor` varchar(16) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `expense_grid_styles_id` PRIMARY KEY(`id`),
	CONSTRAINT `expense_grid_styles_target_unique` UNIQUE(`userId`,`targetType`,`targetKey`)
);
--> statement-breakpoint
ALTER TABLE `expenses` MODIFY COLUMN `expenseType` enum('socio_1','socio_2','participant','global_shared') NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','socio_1','socio_2','participante','contador','admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `displayName` varchar(120);--> statement-breakpoint
ALTER TABLE `expense_change_logs` ADD CONSTRAINT `expense_change_logs_expenseId_expenses_id_fk` FOREIGN KEY (`expenseId`) REFERENCES `expenses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expense_change_logs` ADD CONSTRAINT `expense_change_logs_changedByUserId_users_id_fk` FOREIGN KEY (`changedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expense_grid_styles` ADD CONSTRAINT `expense_grid_styles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `expense_change_logs_expense_idx` ON `expense_change_logs` (`expenseId`);
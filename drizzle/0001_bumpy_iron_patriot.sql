CREATE TABLE `expense_approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`expenseId` int NOT NULL,
	`reviewedByUserId` int NOT NULL,
	`decision` enum('approved','rejected') NOT NULL,
	`comments` text,
	`reviewedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `expense_approvals_id` PRIMARY KEY(`id`),
	CONSTRAINT `expense_approvals_expense_unique` UNIQUE(`expenseId`)
);
--> statement-breakpoint
CREATE TABLE `expense_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`label` varchar(80) NOT NULL,
	`color` varchar(16) NOT NULL,
	`sortOrder` int NOT NULL,
	`isActive` enum('yes','no') NOT NULL DEFAULT 'yes',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `expense_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `expense_categories_label_unique` UNIQUE(`label`)
);
--> statement-breakpoint
CREATE TABLE `expense_invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`expenseId` int NOT NULL,
	`uploadedByUserId` int NOT NULL,
	`originalName` varchar(255) NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`fileUrl` varchar(700) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`fileSize` int NOT NULL,
	`archivedMonth` varchar(7) NOT NULL,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `expense_invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`createdByUserId` int NOT NULL,
	`categoryId` int NOT NULL,
	`description` text NOT NULL,
	`amount` decimal(14,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'DOP',
	`incurredOn` date NOT NULL,
	`reportingMonth` varchar(7) NOT NULL,
	`expenseType` enum('socio_1','socio_2','global_shared') NOT NULL,
	`status` enum('draft','submitted','approved','rejected') NOT NULL DEFAULT 'draft',
	`submittedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','socio_1','socio_2','contador','admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `expense_approvals` ADD CONSTRAINT `expense_approvals_expenseId_expenses_id_fk` FOREIGN KEY (`expenseId`) REFERENCES `expenses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expense_approvals` ADD CONSTRAINT `expense_approvals_reviewedByUserId_users_id_fk` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expense_invoices` ADD CONSTRAINT `expense_invoices_expenseId_expenses_id_fk` FOREIGN KEY (`expenseId`) REFERENCES `expenses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expense_invoices` ADD CONSTRAINT `expense_invoices_uploadedByUserId_users_id_fk` FOREIGN KEY (`uploadedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_categoryId_expense_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `expense_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `expense_invoices_expense_idx` ON `expense_invoices` (`expenseId`);--> statement-breakpoint
CREATE INDEX `expense_invoices_month_idx` ON `expense_invoices` (`archivedMonth`);--> statement-breakpoint
CREATE INDEX `expenses_reporting_month_idx` ON `expenses` (`reportingMonth`);--> statement-breakpoint
CREATE INDEX `expenses_creator_idx` ON `expenses` (`createdByUserId`);--> statement-breakpoint
CREATE INDEX `expenses_status_idx` ON `expenses` (`status`);--> statement-breakpoint
CREATE INDEX `expenses_type_idx` ON `expenses` (`expenseType`);
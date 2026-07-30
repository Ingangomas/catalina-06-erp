CREATE TABLE `project_identity_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`displayName` varchar(120) NOT NULL,
	`role` enum('socio_1','socio_2','participante','contador','admin') NOT NULL,
	`expenseOwnerType` enum('socio_1','socio_2','participante'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_identity_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `project_identity_profiles_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `expenseOwnerType` enum('socio_1','socio_2','participante');
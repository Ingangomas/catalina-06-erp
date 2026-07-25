ALTER TABLE `expense_change_logs` MODIFY COLUMN `action` enum('created','updated','ai_extracted','submitted','reviewed','voided') NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` MODIFY COLUMN `status` enum('draft','submitted','approved','rejected','voided') NOT NULL DEFAULT 'draft';
ALTER TABLE `expense_change_logs` MODIFY COLUMN `action` enum('created','updated','ai_extracted','submitted','reviewed','voided') NOT NULL;

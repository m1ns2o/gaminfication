CREATE TABLE `teacher_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_teacher_accounts_email` ON `teacher_accounts` (`email`);--> statement-breakpoint
CREATE TABLE `teacher_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`teacher_id` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`teacher_id`) REFERENCES `teacher_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_teacher_sessions_teacher` ON `teacher_sessions` (`teacher_id`);--> statement-breakpoint
CREATE INDEX `idx_teacher_sessions_expiry` ON `teacher_sessions` (`expires_at`);
CREATE TABLE `oauth_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`provider_subject` text NOT NULL,
	`teacher_id` text NOT NULL,
	`email` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`teacher_id`) REFERENCES `teacher_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_oauth_accounts_provider_subject` ON `oauth_accounts` (`provider`,`provider_subject`);--> statement-breakpoint
CREATE INDEX `idx_oauth_accounts_teacher` ON `oauth_accounts` (`teacher_id`);
CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`effect_type` text NOT NULL,
	`effect_value` integer DEFAULT 0 NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_cards_game_order` ON `cards` (`game_id`,`order_index`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`type` text NOT NULL,
	`prompt` text NOT NULL,
	`options_json` text DEFAULT '[]' NOT NULL,
	`correct_answer` text NOT NULL,
	`explanation` text DEFAULT '' NOT NULL,
	`points` integer DEFAULT 10 NOT NULL,
	`time_limit_seconds` integer DEFAULT 30 NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_questions_game_order` ON `questions` (`game_id`,`order_index`);
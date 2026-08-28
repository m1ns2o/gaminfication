CREATE TABLE `room_results` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`nickname` text NOT NULL,
	`score` integer NOT NULL,
	`correct_answers` integer DEFAULT 0 NOT NULL,
	`answers_count` integer DEFAULT 0 NOT NULL,
	`rank` integer NOT NULL,
	`is_winner` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participant_id`) REFERENCES `room_participants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_room_results_participant` ON `room_results` (`room_id`,`participant_id`);--> statement-breakpoint
CREATE INDEX `idx_room_results_rank` ON `room_results` (`room_id`,`rank`);--> statement-breakpoint
ALTER TABLE `games` ADD `victory_mode` text DEFAULT 'AUTO' NOT NULL;--> statement-breakpoint
ALTER TABLE `games` ADD `target_score` integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `games` ADD `max_rounds` integer DEFAULT 10 NOT NULL;
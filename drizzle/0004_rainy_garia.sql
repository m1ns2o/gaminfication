CREATE TABLE `request_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `room_question_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`question_id` text NOT NULL,
	`question_sequence` integer NOT NULL,
	`participant_id` text NOT NULL,
	`question_prompt` text NOT NULL,
	`question_type` text NOT NULL,
	`answer_mode` text NOT NULL,
	`submitted_answer` text DEFAULT '' NOT NULL,
	`correct_answer` text NOT NULL,
	`is_correct` integer DEFAULT false NOT NULL,
	`points_awarded` integer DEFAULT 0 NOT NULL,
	`timed_out` integer DEFAULT false NOT NULL,
	`response_time_ms` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participant_id`) REFERENCES `room_participants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_room_responses_attempt_participant` ON `room_question_responses` (`room_id`,`question_sequence`,`participant_id`);--> statement-breakpoint
CREATE INDEX `idx_room_responses_room_question` ON `room_question_responses` (`room_id`,`question_id`);--> statement-breakpoint
CREATE INDEX `idx_room_responses_participant` ON `room_question_responses` (`room_id`,`participant_id`);--> statement-breakpoint
ALTER TABLE `games` ADD `play_mode` text DEFAULT 'INDIVIDUAL' NOT NULL;--> statement-breakpoint
ALTER TABLE `games` ADD `team_count` integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `questions` ADD `answer_mode` text DEFAULT 'TURN' NOT NULL;--> statement-breakpoint
ALTER TABLE `room_results` ADD `team_number` integer;--> statement-breakpoint
ALTER TABLE `room_results` ADD `team_score` integer;
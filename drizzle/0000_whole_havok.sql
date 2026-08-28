CREATE TABLE `game_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`definition_json` text NOT NULL,
	`immutable` integer DEFAULT true NOT NULL,
	`review_status` text DEFAULT 'PRIVATE' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_game_versions_game_number` ON `game_versions` (`game_id`,`version_number`);--> statement-breakpoint
CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`subject` text DEFAULT '미지정' NOT NULL,
	`grade` text DEFAULT '미지정' NOT NULL,
	`template` text NOT NULL,
	`skin` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`visibility` text DEFAULT 'PRIVATE' NOT NULL,
	`questions_count` integer DEFAULT 0 NOT NULL,
	`cards_count` integer DEFAULT 0 NOT NULL,
	`source_version_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_games_owner_updated` ON `games` (`owner_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_games_library` ON `games` (`visibility`,`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`avatar_url` text,
	`is_anonymous` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `room_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`auth_user_id` text NOT NULL,
	`nickname` text NOT NULL,
	`team_number` integer,
	`is_team_leader` integer DEFAULT false NOT NULL,
	`joined_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_participants_room_auth` ON `room_participants` (`room_id`,`auth_user_id`);--> statement-breakpoint
CREATE INDEX `idx_participants_room` ON `room_participants` (`room_id`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`host_id` text NOT NULL,
	`code` text NOT NULL,
	`status` text DEFAULT 'LOBBY' NOT NULL,
	`state_json` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_rooms_code` ON `rooms` (`code`);--> statement-breakpoint
CREATE INDEX `idx_rooms_host_created` ON `rooms` (`host_id`,`created_at`);
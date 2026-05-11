CREATE TABLE `admin_events` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`event_type` text NOT NULL,
	`user_id` text,
	`user_email` text,
	`league_id` text,
	`payload` text,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `game_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`league_id` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`scheduled_for` text,
	`location` text,
	`player_count` integer NOT NULL,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "game_sessions_player_count" CHECK("game_sessions"."player_count" in (6, 8, 10, 12))
);
--> statement-breakpoint
CREATE INDEX `idx_game_sessions_league_scheduled` ON `game_sessions` (`league_id`,`scheduled_for`);--> statement-breakpoint
CREATE TABLE `league_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`league_id` text NOT NULL,
	`email` text NOT NULL,
	`invited_by` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`accepted_at` text,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "league_invites_status" CHECK("league_invites"."status" in ('pending', 'accepted', 'revoked'))
);
--> statement-breakpoint
CREATE INDEX `idx_league_invites_email` ON `league_invites` (`email`);--> statement-breakpoint
CREATE INDEX `idx_league_invites_league_id` ON `league_invites` (`league_id`);--> statement-breakpoint
CREATE TABLE `league_members` (
	`league_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'player' NOT NULL,
	`email` text,
	`created_at` text DEFAULT (datetime('now')),
	PRIMARY KEY(`league_id`, `user_id`),
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "league_members_role" CHECK("league_members"."role" in ('player', 'admin'))
);
--> statement-breakpoint
CREATE INDEX `idx_league_members_user_id` ON `league_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `leagues` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`name` text NOT NULL,
	`owner_id` text NOT NULL,
	CONSTRAINT "leagues_name_len" CHECK(length("leagues"."name") >= 1 and length("leagues"."name") <= 255)
);
--> statement-breakpoint
CREATE TABLE `match_players` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`user_id` text,
	`guest_id` text,
	`team` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`guest_id`) REFERENCES `session_guests`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "match_players_team" CHECK("match_players"."team" in (1, 2)),
	CONSTRAINT "match_players_one_identity" CHECK(("match_players"."user_id" is null) <> ("match_players"."guest_id" is null))
);
--> statement-breakpoint
CREATE INDEX `idx_match_players_user_id` ON `match_players` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `match_players_match_user_uq` ON `match_players` (`match_id`,`user_id`) WHERE "match_players"."user_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `match_players_match_guest_uq` ON `match_players` (`match_id`,`guest_id`) WHERE "match_players"."guest_id" is not null;--> statement-breakpoint
CREATE TABLE `match_results` (
	`match_id` text PRIMARY KEY NOT NULL,
	`team1_score` integer,
	`team2_score` integer,
	`completed_at` text,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`court_number` integer,
	`scheduled_order` integer,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`session_id`) REFERENCES `game_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "matches_status" CHECK("matches"."status" in ('scheduled', 'completed', 'canceled'))
);
--> statement-breakpoint
CREATE INDEX `idx_matches_session_id` ON `matches` (`session_id`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	`email` text,
	`first_name` text,
	`last_name` text,
	`gender` text,
	`dupr_id` text,
	`self_reported_dupr` real,
	`display_name` text,
	`avatar_url` text
);
--> statement-breakpoint
CREATE TABLE `session_guests` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`display_name` text NOT NULL,
	`dupr` real NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `game_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "session_guests_display_name" CHECK(length(trim("session_guests"."display_name")) > 0),
	CONSTRAINT "session_guests_dupr_range" CHECK("session_guests"."dupr" >= 1.0 and "session_guests"."dupr" <= 8.5)
);
--> statement-breakpoint
CREATE INDEX `session_guests_session_id_idx` ON `session_guests` (`session_id`);
CREATE INDEX `idx_admin_events_type_created` ON `admin_events` (`event_type`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_admin_events_created_at` ON `admin_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_admin_events_league_id` ON `admin_events` (`league_id`);
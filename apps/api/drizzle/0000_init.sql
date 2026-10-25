CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text,
	`all_day` integer NOT NULL,
	`timezone` text NOT NULL,
	`location` text,
	`color` text NOT NULL,
	`reminders` text DEFAULT '[]' NOT NULL,
	`rrule` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `events_deleted_start_idx` ON `events` (`deleted_at`,`start_at`);--> statement-breakpoint
CREATE INDEX `events_updated_idx` ON `events` (`updated_at`);
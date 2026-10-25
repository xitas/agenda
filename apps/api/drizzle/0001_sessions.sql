CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`label` text NOT NULL,
	`created_at` text NOT NULL,
	`last_used_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_idx` ON `sessions` (`token_hash`);
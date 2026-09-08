ALTER TABLE `session_requirements` ADD `skipped` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `session_requirements` ADD `skip_reason` text;
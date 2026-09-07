CREATE TABLE `exercise_muscle_groups` (
	`exercise_id` text NOT NULL,
	`muscle_group_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`exercise_id`, `muscle_group_id`),
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`muscle_group_id`) REFERENCES `muscle_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`aliases` text DEFAULT '[]' NOT NULL,
	`tracking` text DEFAULT 'weightReps' NOT NULL,
	`weight_increment_kg` real DEFAULT 2.5 NOT NULL,
	`default_rest_seconds` integer DEFAULT 90 NOT NULL,
	`notes` text,
	`archived` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `families` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`position` integer NOT NULL,
	`uses_muscle_groups` integer DEFAULT true NOT NULL,
	`archived` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `family_muscle_groups` (
	`family_id` text NOT NULL,
	`muscle_group_id` text NOT NULL,
	`position` integer NOT NULL,
	`required_exercise_count` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`family_id`, `muscle_group_id`),
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`muscle_group_id`) REFERENCES `muscle_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `muscle_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`position` integer NOT NULL,
	`implicit` integer DEFAULT false NOT NULL,
	`archived` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session_requirements` (
	`session_id` text NOT NULL,
	`muscle_group_id` text NOT NULL,
	`position` integer NOT NULL,
	`required_exercise_count` integer NOT NULL,
	PRIMARY KEY(`session_id`, `muscle_group_id`),
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`muscle_group_id`) REFERENCES `muscle_groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`date` text NOT NULL,
	`started_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`finished_at` text,
	`status` text DEFAULT 'inProgress' NOT NULL,
	`notes` text,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_date_idx` ON `sessions` (`date`);--> statement-breakpoint
CREATE INDEX `sessions_family_idx` ON `sessions` (`family_id`);--> statement-breakpoint
CREATE TABLE `set_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`muscle_group_id` text NOT NULL,
	`set_number` integer NOT NULL,
	`reps` integer,
	`weight_kg` real,
	`duration_seconds` integer,
	`distance_m` real,
	`warmup` integer DEFAULT false NOT NULL,
	`completed` integer DEFAULT true NOT NULL,
	`skipped` integer DEFAULT false NOT NULL,
	`skip_reason` text,
	`note` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`muscle_group_id`) REFERENCES `muscle_groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `set_entries_unique_idx` ON `set_entries` (`session_id`,`exercise_id`,`muscle_group_id`,`set_number`);--> statement-breakpoint
CREATE INDEX `set_entries_pairing_idx` ON `set_entries` (`exercise_id`,`muscle_group_id`);--> statement-breakpoint
CREATE INDEX `set_entries_session_idx` ON `set_entries` (`session_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `weekly_schedule` (
	`day_of_week` integer PRIMARY KEY NOT NULL,
	`family_id` text,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE set null
);

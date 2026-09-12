CREATE TABLE `session_exercise_notes` (
	`session_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`muscle_group_id` text NOT NULL,
	`note` text NOT NULL,
	PRIMARY KEY(`session_id`, `exercise_id`, `muscle_group_id`),
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`muscle_group_id`) REFERENCES `muscle_groups`(`id`) ON UPDATE no action ON DELETE no action
);

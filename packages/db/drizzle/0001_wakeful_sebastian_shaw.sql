ALTER TABLE `transcript_segments` ADD `platform` text;--> statement-breakpoint
ALTER TABLE `transcript_segments` ADD `medium` text;--> statement-breakpoint
UPDATE `transcript_segments` SET `platform` = 'discord', `medium` = 'voice' WHERE `platform` IS NULL AND `source` = 'discord-voice';--> statement-breakpoint
UPDATE `transcript_segments` SET `platform` = 'discord', `medium` = 'text' WHERE `platform` IS NULL AND `source` = 'discord-text';--> statement-breakpoint
UPDATE `transcript_segments` SET `platform` = 'upload', `medium` = 'text' WHERE `platform` IS NULL AND `source` = 'transcript-file';
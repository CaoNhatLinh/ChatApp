-- Migration: Replace is_activity_status_enabled with status_preference
-- Date: 2026-03-03
-- Description: Add status_preference (ONLINE, DND, INVISIBLE) to replace is_activity_status_enabled
-- Usage: Run this on existing database to add new columns and remove old one

-- Step 1: Add new columns
ALTER TABLE chat_app.users ADD status_preference text;
ALTER TABLE chat_app.users ADD status_updated_at timestamp;

-- Step 2: Remove deprecated column
ALTER TABLE chat_app.users DROP is_activity_status_enabled;

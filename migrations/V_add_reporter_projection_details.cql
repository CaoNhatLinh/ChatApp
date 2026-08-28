-- Preserve the user-facing report history fields in the reporter projection.
-- Existing rows remain readable and return null for fields that predate this migration.
ALTER TABLE reports_by_reporter ADD target_type text;
ALTER TABLE reports_by_reporter ADD reason_code text;
ALTER TABLE reports_by_reporter ADD description text;

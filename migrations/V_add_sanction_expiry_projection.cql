-- Bounded lookup projection for expiring timed APP/CONVERSATION sanctions.
CREATE TABLE IF NOT EXISTS user_sanctions_by_expiry_day (
  expiry_day date,
  expires_at timestamp,
  sanction_id uuid,
  user_id uuid,
  imposed_at timeuuid,
  scope text,
  conversation_id uuid,
  sanction_type text,
  starts_at timestamp,
  imposed_by uuid,
  reason_code text,
  reason_text text,
  status text,
  PRIMARY KEY ((expiry_day), expires_at, sanction_id)
) WITH CLUSTERING ORDER BY (expires_at ASC, sanction_id ASC);

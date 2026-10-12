/*
 * Optional Firebase Google identity owner projection.
 * Every provider/subject pair is its own bounded partition; do not partition by
 * provider alone because that would place every Google account in one partition.
 */
CREATE TABLE IF NOT EXISTS external_identity_owner_by_key (
  auth_provider text,
  external_subject text,
  user_id uuid,
  created_at timestamp,
  PRIMARY KEY ((auth_provider, external_subject))
);

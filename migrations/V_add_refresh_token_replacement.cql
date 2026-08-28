/* Expand refresh-token owner rows so rotation remains auditable by token id. */
ALTER TABLE refresh_token_owner_by_id ADD replaced_by_token_id uuid;

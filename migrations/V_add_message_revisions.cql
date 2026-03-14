CREATE TABLE IF NOT EXISTS message_revisions (
    conversation_id uuid,
    message_id timeuuid,
    revision_number int,
    content text,
    edited_at timestamp,
    edited_by uuid,
    action text,
    PRIMARY KEY ((conversation_id, message_id), revision_number)
) WITH CLUSTERING ORDER BY (revision_number DESC);
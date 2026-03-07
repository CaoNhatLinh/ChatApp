-- Create user_presence table
CREATE TABLE user_presence (
    user_id UUID PRIMARY KEY,
    status VARCHAR(20) NOT NULL DEFAULT 'OFFLINE',
    last_seen TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    device VARCHAR(50)
);

-- Create index for faster queries
CREATE INDEX idx_user_presence_status ON user_presence (status);
CREATE INDEX idx_user_presence_updated_at ON user_presence (updated_at);

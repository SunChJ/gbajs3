-- D1 Database Schema for gbajs3

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    pass_hash TEXT NOT NULL,
    token_slug TEXT,
    token_id TEXT,
    storage_dir TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Create index on token_id for faster token validation
CREATE INDEX IF NOT EXISTS idx_users_token_id ON users(token_id);

-- Create index on username for faster login
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

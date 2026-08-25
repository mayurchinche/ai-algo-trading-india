-- Run this in Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)
-- Creates the app_data table for cross-device sync

CREATE TABLE IF NOT EXISTS app_data (
  id TEXT PRIMARY KEY,
  device_id TEXT,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (optional — currently using anon key, all data is shared)
-- For multi-user: add user_id column + RLS policies
ALTER TABLE app_data ENABLE ROW LEVEL SECURITY;

-- Allow all operations with anon key (single user)
CREATE POLICY "Allow all" ON app_data FOR ALL USING (true) WITH CHECK (true);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_app_data_updated ON app_data(updated_at);

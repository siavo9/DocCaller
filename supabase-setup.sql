-- DocCaller: Scheduled Sessions Table
-- Run this in your Supabase SQL Editor

CREATE TABLE scheduled_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Patient info (JSON blob)
  patient JSONB NOT NULL,
  patient_email TEXT NOT NULL,
  patient_name TEXT,

  -- Appointments to schedule (JSON array)
  appointments JSONB NOT NULL,

  -- When to make the calls (UTC)
  scheduled_for TIMESTAMPTZ NOT NULL,
  timezone TEXT DEFAULT 'America/New_York',

  -- Job status: pending → calling → completed / failed
  status TEXT DEFAULT 'pending',

  -- Call results from Bland.ai (populated by cron)
  -- Array of { callId, doctorName, phone, status, details, transcript, specialty }
  calls JSONB,

  -- Whether the results email has been sent
  email_sent BOOLEAN DEFAULT false
);

-- Index for cron job queries
CREATE INDEX idx_sessions_status_scheduled ON scheduled_sessions (status, scheduled_for);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON scheduled_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Enable Row Level Security (but allow service role full access)
ALTER TABLE scheduled_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: allow inserts from anon/authenticated (for the API)
CREATE POLICY "Allow inserts" ON scheduled_sessions
  FOR INSERT WITH CHECK (true);

-- Policy: allow selects (for status polling)
CREATE POLICY "Allow selects" ON scheduled_sessions
  FOR SELECT USING (true);

-- Policy: allow updates (for cron job)
CREATE POLICY "Allow updates" ON scheduled_sessions
  FOR UPDATE USING (true);

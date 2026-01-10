-- Adds last_discovered timestamp to track when metadata was last scanned
ALTER TABLE sources
  ADD COLUMN IF NOT EXISTS last_discovered TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS discovery_reason TEXT;

-- Creates table to store user or automated feedback on scout decisions
CREATE TABLE IF NOT EXISTS scout_feedback (
  id          SERIAL PRIMARY KEY,
  dataset_id  TEXT NOT NULL,
  decision    TEXT NOT NULL,      -- 'include' or 'exclude'
  feedback    TEXT NOT NULL,      -- brief reason for correction
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better performance on scout_feedback queries
CREATE INDEX IF NOT EXISTS scout_feedback_dataset_id_idx ON scout_feedback(dataset_id);
CREATE INDEX IF NOT EXISTS scout_feedback_decision_idx ON scout_feedback(decision);

-- Create index on sources last_discovered for scout queries
CREATE INDEX IF NOT EXISTS sources_last_discovered_idx ON sources(last_discovered); 
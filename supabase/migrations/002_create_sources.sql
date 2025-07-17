-- Table: sources
-- Tracks each connector's code, human name, implementation module,
-- fetch cadence, prompt to use, config, and last run time.

CREATE TABLE sources (
  id             SERIAL PRIMARY KEY,
  code           TEXT UNIQUE NOT NULL,      -- e.g. "socrata_inspections"
  name           TEXT NOT NULL,             -- e.g. "Food Inspections"
  connector      TEXT NOT NULL,             -- e.g. "SocrataConnector"
  fetch_interval INTERVAL NOT NULL,         -- e.g. '1 hour'
  prompt_code    TEXT,                      -- e.g. "daily_inspection_summary"
  config         JSONB,                     -- connector params
  last_fetched   TIMESTAMPTZ                 -- last successful fetch
); 
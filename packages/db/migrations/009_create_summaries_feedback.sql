-- Table: summaries (per‑category output texts)
CREATE TABLE summaries (
  run_id   UUID REFERENCES agent_runs(id),
  category TEXT NOT NULL,
  output   TEXT NOT NULL,
  PRIMARY KEY(run_id, category)
);

-- Table: run_feedback (validation results/human feedback)
CREATE TABLE run_feedback (
  run_id     UUID REFERENCES agent_runs(id),
  feedback   JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
); 
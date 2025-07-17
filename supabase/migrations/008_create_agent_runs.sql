-- Table: agent_runs (logs each LLM invocation)
CREATE TABLE agent_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id    INT REFERENCES sources(id),
  prompt_id    INT REFERENCES prompt_templates(id),
  run_at       TIMESTAMPTZ DEFAULT now(),
  status       TEXT,                     
  duration_ms  INT,                      
  error        TEXT                      
); 
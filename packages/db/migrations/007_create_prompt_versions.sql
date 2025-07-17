-- Table: prompt_versions (history of prompt edits/A/B tests)
CREATE TABLE prompt_versions (
  id           SERIAL PRIMARY KEY,
  prompt_id    INT REFERENCES prompt_templates(id),
  version_note TEXT,                    
  template     TEXT NOT NULL,           
  created_at   TIMESTAMPTZ DEFAULT now()
); 
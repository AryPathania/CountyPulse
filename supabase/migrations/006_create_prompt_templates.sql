-- Table: prompt_templates (LLM prompt definitions)
CREATE TABLE prompt_templates (
  id          SERIAL PRIMARY KEY,
  code        TEXT UNIQUE NOT NULL,    
  description TEXT,                     
  template    TEXT NOT NULL             
); 
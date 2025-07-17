-- Table: raw_items
-- Stores immutable fetched payloads, linked to sources.

CREATE TABLE raw_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),  
  source_id    INT REFERENCES sources(id),                  
  external_id  TEXT,                                        
  fetched_at   TIMESTAMPTZ DEFAULT now(),                   
  raw_payload  JSONB NOT NULL                               
); 
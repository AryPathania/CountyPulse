-- Table: normalized_items
-- Parsed and enriched records with embeddings for semantic search.

CREATE TABLE normalized_items (
  id           UUID PRIMARY KEY REFERENCES raw_items(id),  
  category     TEXT NOT NULL,                              
  title        TEXT,                                       
  summary      TEXT,                                       
  published_at TIMESTAMPTZ,                                
  metadata     JSONB,                                      
  embedding    VECTOR(1536),                               
  indexed_at   TIMESTAMPTZ DEFAULT now()                   
); 
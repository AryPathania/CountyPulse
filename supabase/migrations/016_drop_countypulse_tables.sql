-- Migration 016: Drop CountyPulse-specific tables
-- Pivot from CountyPulse to Odie Resume
-- Keep: user_profiles (will be extended for Odie)
-- Drop: all domain tables from CountyPulse

-- Drop in order respecting FK constraints (children first)

-- 1. Tables with no dependents
DROP TABLE IF EXISTS item_events CASCADE;
DROP TABLE IF EXISTS scout_feedback CASCADE;

-- 2. Tables referencing agent_runs
DROP TABLE IF EXISTS run_feedback CASCADE;
DROP TABLE IF EXISTS summaries CASCADE;

-- 3. Tables referencing normalized_items and categories
DROP TABLE IF EXISTS item_tags CASCADE;

-- 4. Tables referencing categories
DROP TABLE IF EXISTS watches CASCADE;

-- 5. Categories (now safe after item_tags and watches dropped)
DROP TABLE IF EXISTS categories CASCADE;

-- 6. Tables referencing prompt_templates and sources
DROP TABLE IF EXISTS agent_runs CASCADE;

-- 7. Tables referencing prompt_templates
DROP TABLE IF EXISTS prompt_versions CASCADE;

-- 8. Prompt templates (now safe after prompt_versions and agent_runs dropped)
DROP TABLE IF EXISTS prompt_templates CASCADE;

-- 9. Tables referencing raw_items
DROP TABLE IF EXISTS normalized_items CASCADE;

-- 10. Tables referencing sources
DROP TABLE IF EXISTS raw_items CASCADE;

-- 11. Sources (now safe after raw_items and agent_runs dropped)
DROP TABLE IF EXISTS sources CASCADE;

-- Note: user_profiles retained for Odie
-- Note: vector extension retained (will be used for bullet embeddings)

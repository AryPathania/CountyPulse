-- Migration 023: Add parsed requirements and gap analysis columns to job_drafts
-- Supports per-requirement matching and gap analysis for "What's Missing" feature

ALTER TABLE job_drafts ADD COLUMN parsed_requirements JSONB;
ALTER TABLE job_drafts ADD COLUMN gap_analysis JSONB;

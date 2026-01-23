-- Add is_draft column to bullets table
-- Bullets saved during interview are drafts until interview completes

ALTER TABLE bullets
ADD COLUMN is_draft boolean NOT NULL DEFAULT false;

-- Create index for filtering drafts
CREATE INDEX bullets_user_is_draft_idx ON bullets (user_id, is_draft);

-- Comment for documentation
COMMENT ON COLUMN bullets.is_draft IS 'True while bullet is being captured during interview, false after interview completes';

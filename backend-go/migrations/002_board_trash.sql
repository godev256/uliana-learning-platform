ALTER TABLE boards ADD COLUMN deleted_at timestamptz;
ALTER TABLE boards ADD CONSTRAINT main_board_not_trashed CHECK (id <> 'main' OR deleted_at IS NULL);
CREATE INDEX boards_trash_expiry ON boards(deleted_at) WHERE deleted_at IS NOT NULL;

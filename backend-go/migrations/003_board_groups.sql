CREATE TABLE board_groups (
 student_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 id text NOT NULL, title text NOT NULL, sort_order integer NOT NULL,
 PRIMARY KEY(student_id,id)
);
ALTER TABLE boards ADD COLUMN group_id text;
ALTER TABLE boards ADD CONSTRAINT boards_group_owner FOREIGN KEY(student_id,group_id) REFERENCES board_groups(student_id,id);
ALTER TABLE boards ADD CONSTRAINT main_board_ungrouped CHECK(id <> 'main' OR group_id IS NULL);
CREATE INDEX boards_group ON boards(student_id,group_id);

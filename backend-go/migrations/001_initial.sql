CREATE TABLE users (
 id text PRIMARY KEY, login text NOT NULL UNIQUE, password_hash text NOT NULL,
 role text NOT NULL CHECK (role IN ('teacher','student')), created_at bigint NOT NULL
);
CREATE UNIQUE INDEX users_single_teacher ON users(role) WHERE role='teacher';
CREATE TABLE sessions (
 id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE login_attempts (
 key text PRIMARY KEY, attempts integer NOT NULL, reset_at timestamptz NOT NULL
);
CREATE TABLE boards (
 student_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, id text NOT NULL,
 title text NOT NULL, kind text NOT NULL CHECK (kind IN ('board','pdf')),
 sort_order integer NOT NULL, page_count integer NOT NULL CHECK (page_count BETWEEN 1 AND 100),
 revision bigint NOT NULL CHECK (revision>=0), item_order jsonb NOT NULL, PRIMARY KEY (student_id,id)
);
CREATE INDEX boards_student_order ON boards(student_id,sort_order,id);
CREATE TABLE pages (
 student_id text NOT NULL, board_id text NOT NULL, number integer NOT NULL CHECK (number>=0),
 items jsonb NOT NULL CHECK (jsonb_typeof(items)='array'), PRIMARY KEY (student_id,board_id,number),
 FOREIGN KEY(student_id,board_id) REFERENCES boards(student_id,id) ON DELETE CASCADE
);
CREATE TABLE assets (
 student_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, id text NOT NULL,
 part integer NOT NULL CHECK (part>=0 AND part<200), total integer NOT NULL CHECK (total BETWEEN 1 AND 200),
 mime text NOT NULL, data bytea NOT NULL, PRIMARY KEY(student_id,id,part), CHECK (part<total)
);
CREATE TABLE documents (
 student_id text NOT NULL, board_id text NOT NULL, asset_id text NOT NULL, name text NOT NULL,
 page_count integer NOT NULL, PRIMARY KEY(student_id,board_id),
 FOREIGN KEY(student_id,board_id) REFERENCES boards(student_id,id) ON DELETE CASCADE
);
CREATE TABLE profiles (
 student_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 schedule jsonb NOT NULL, lessons jsonb NOT NULL, calendar jsonb NOT NULL
);

package postgres

import (
	"context"
	sq "github.com/Masterminds/squirrel"
	"ulianaa.math/backend/internal/model"
)

// ImportEmpty is an explicit administrative import. It never overwrites existing data.
func (s *Store) ImportEmpty(ctx context.Context, snapshot model.Snapshot) error {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, "LOCK TABLE users IN EXCLUSIVE MODE"); err != nil {
		return err
	}
	var count int
	if err = builder.Select("count(*)").From("users").RunWith(tx).QueryRowContext(ctx).Scan(&count); err != nil {
		return err
	}
	if count != 0 {
		return model.Bad("Destination database is not empty; import refused")
	}
	for _, u := range snapshot.Users {
		if _, err = builder.Insert("users").Columns("id", "login", "role", "created_at", "password_hash").Values(u.ID, u.Login, u.Role, u.CreatedAt, u.PasswordHash).RunWith(tx).ExecContext(ctx); err != nil {
			return err
		}
	}
	for _, a := range snapshot.Assets {
		if _, err = builder.Insert("assets").Columns("student_id", "id", "part", "total", "mime", "data").Values(a.StudentID, a.ID, a.Part, a.Total, a.Mime, a.Data).RunWith(tx).ExecContext(ctx); err != nil {
			return err
		}
	}
	for _, p := range snapshot.Profiles {
		if _, err = builder.Insert("profiles").Columns("student_id", "schedule", "lessons", "calendar").Values(p.StudentID, string(p.Schedule), string(p.Lessons), string(p.Calendar)).RunWith(tx).ExecContext(ctx); err != nil {
			return err
		}
	}
	for _, b := range snapshot.Boards {
		if err = insertTopic(ctx, tx, b.StudentID, b.Topic, b.Notebook); err != nil {
			return err
		}
		if _, err = builder.Update("boards").Set("revision", b.Revision).Where(sq.Eq{"student_id": b.StudentID, "id": b.Topic.ID}).RunWith(tx).ExecContext(ctx); err != nil {
			return err
		}
		if b.Document != nil {
			d := b.Document
			if _, err = builder.Insert("documents").Columns("student_id", "board_id", "asset_id", "name", "page_count").Values(b.StudentID, b.Topic.ID, d.AssetID, d.Name, d.PageCount).RunWith(tx).ExecContext(ctx); err != nil {
				return err
			}
		}
	}
	return tx.Commit()
}

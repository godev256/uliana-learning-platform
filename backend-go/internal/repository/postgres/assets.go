package postgres

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	sq "github.com/Masterminds/squirrel"
	"ulianaa.math/backend/internal/model"
)

func (s *Store) PutAsset(ctx context.Context, student, id string, part int, a model.Asset) error {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err = lockOwner(ctx, tx, student); err != nil {
		return err
	}
	var total int
	var mime string
	err = builder.Select("total", "mime").From("assets").Where(sq.Eq{"student_id": student, "id": id}).Limit(1).RunWith(tx).QueryRowContext(ctx).Scan(&total, &mime)
	if err != nil && err != sql.ErrNoRows {
		return err
	}
	if err == nil && (total != a.Total || mime != a.Mime) {
		return model.ErrExists
	}
	var existing []byte
	err = builder.Select("data").From("assets").Where(sq.Eq{"student_id": student, "id": id, "part": part}).RunWith(tx).QueryRowContext(ctx).Scan(&existing)
	if err == nil {
		if !bytes.Equal(existing, a.Data) {
			return model.ErrExists
		}
		return tx.Commit()
	}
	if err != sql.ErrNoRows {
		return err
	}
	_, err = builder.Insert("assets").Columns("student_id", "id", "part", "total", "mime", "data").Values(student, id, part, a.Total, a.Mime, a.Data).RunWith(tx).ExecContext(ctx)
	if err != nil {
		return err
	}
	return tx.Commit()
}
func (s *Store) Asset(ctx context.Context, student, id string, part int) (a model.Asset, err error) {
	err = builder.Select("data", "total", "mime").From("assets").Where(sq.Eq{"student_id": student, "id": id, "part": part}).RunWith(s.DB).QueryRowContext(ctx).Scan(&a.Data, &a.Total, &a.Mime)
	return a, translate(err)
}
func (s *Store) AssetParts(ctx context.Context, student, id string) ([]model.Asset, error) {
	rows, err := builder.Select("data", "total", "mime", "part").From("assets").Where(sq.Eq{"student_id": student, "id": id}).OrderBy("part").RunWith(s.DB).QueryContext(ctx)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []model.Asset{}
	for rows.Next() {
		var a model.Asset
		var part int
		if err = rows.Scan(&a.Data, &a.Total, &a.Mime, &part); err != nil {
			return nil, err
		}
		if part != len(out) {
			return nil, model.Bad("Файл загружен не полностью.")
		}
		out = append(out, a)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	if len(out) == 0 {
		return nil, model.ErrNotFound
	}
	return out, nil
}
func (s *Store) Profile(ctx context.Context, student string) (model.Profile, error) {
	p := model.Profile{Schedule: json.RawMessage("[]"), Lessons: json.RawMessage("[]"), Calendar: json.RawMessage("[]")}
	err := builder.Select("schedule", "lessons", "calendar").From("profiles").Where(sq.Eq{"student_id": student}).RunWith(s.DB).QueryRowContext(ctx).Scan(&p.Schedule, &p.Lessons, &p.Calendar)
	if err == sql.ErrNoRows {
		return p, nil
	}
	return p, err
}
func (s *Store) SaveProfile(ctx context.Context, student string, schedule, lessons, calendar json.RawMessage) error {
	suffix := "ON CONFLICT(student_id) DO UPDATE SET schedule=EXCLUDED.schedule,lessons=EXCLUDED.lessons"
	value := string(calendar)
	if len(calendar) == 0 {
		value = "[]"
	} else {
		suffix += ",calendar=EXCLUDED.calendar"
	}
	_, err := builder.Insert("profiles").Columns("student_id", "schedule", "lessons", "calendar").Values(student, string(schedule), string(lessons), value).Suffix(suffix).RunWith(s.DB).ExecContext(ctx)
	return err
}

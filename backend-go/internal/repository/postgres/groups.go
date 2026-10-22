package postgres

import (
	"context"
	"database/sql"
	"ulianaa.math/backend/internal/model"
)

func nullableGroup(id string) any {
	if id == "" {
		return nil
	}
	return id
}
func validGroup(ctx context.Context, tx *sql.Tx, student, id string) error {
	if id == "" {
		return nil
	}
	var found string
	return translate(tx.QueryRowContext(ctx, "SELECT id FROM board_groups WHERE student_id=$1 AND id=$2", student, id).Scan(&found))
}
func (s *Store) Groups(ctx context.Context, student string) ([]model.BoardGroup, error) {
	rows, err := s.DB.QueryContext(ctx, "SELECT id,title,sort_order FROM board_groups WHERE student_id=$1 ORDER BY sort_order,id", student)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []model.BoardGroup{}
	for rows.Next() {
		var g model.BoardGroup
		if err = rows.Scan(&g.ID, &g.Title, &g.SortOrder); err != nil {
			return nil, err
		}
		out = append(out, g)
	}
	return out, rows.Err()
}
func (s *Store) CreateGroup(ctx context.Context, student string, g model.BoardGroup) error {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err = lockOwner(ctx, tx, student); err != nil {
		return err
	}
	var n, order int
	if err = tx.QueryRowContext(ctx, "SELECT count(*),COALESCE(max(sort_order),-1)+1 FROM board_groups WHERE student_id=$1", student).Scan(&n, &order); err != nil {
		return err
	}
	if n >= 50 {
		return model.Bad("Можно создать до 50 групп досок.")
	}
	if _, err = tx.ExecContext(ctx, "INSERT INTO board_groups(student_id,id,title,sort_order) VALUES($1,$2,$3,$4)", student, g.ID, g.Title, order); err != nil {
		return translate(err)
	}
	return tx.Commit()
}
func (s *Store) RenameGroup(ctx context.Context, student, id, title string) error {
	r, err := s.DB.ExecContext(ctx, "UPDATE board_groups SET title=$1 WHERE student_id=$2 AND id=$3", title, student, id)
	if err != nil {
		return err
	}
	n, err := r.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return model.ErrNotFound
	}
	return nil
}
func (s *Store) DeleteGroup(ctx context.Context, student, id string) error {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err = lockOwner(ctx, tx, student); err != nil {
		return err
	}
	// Preserve active and trashed boards; only the grouping is removed.
	if _, err = tx.ExecContext(ctx, "UPDATE boards SET group_id=NULL WHERE student_id=$1 AND group_id=$2", student, id); err != nil {
		return err
	}
	r, err := tx.ExecContext(ctx, "DELETE FROM board_groups WHERE student_id=$1 AND id=$2", student, id)
	if err != nil {
		return err
	}
	n, err := r.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return model.ErrNotFound
	}
	return tx.Commit()
}
func (s *Store) MoveTopic(ctx context.Context, student, id, group string) error {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err = lockOwner(ctx, tx, student); err != nil {
		return err
	}
	if err = validGroup(ctx, tx, student, group); err != nil {
		return err
	}
	r, err := tx.ExecContext(ctx, "UPDATE boards SET group_id=$1 WHERE student_id=$2 AND id=$3 AND id<>'main' AND deleted_at IS NULL", nullableGroup(group), student, id)
	if err != nil {
		return err
	}
	n, err := r.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return model.ErrNotFound
	}
	return tx.Commit()
}

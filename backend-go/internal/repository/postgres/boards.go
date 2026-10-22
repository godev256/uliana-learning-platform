package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	sq "github.com/Masterminds/squirrel"
	"ulianaa.math/backend/internal/model"
)

func lockOwner(ctx context.Context, tx *sql.Tx, id string) error {
	var found string
	return translate(builder.Select("id").From("users").Where(sq.Eq{"id": id}).Suffix("FOR UPDATE").RunWith(tx).QueryRowContext(ctx).Scan(&found))
}
func pagesOf(book model.Notebook) (map[int][]json.RawMessage, []string, error) {
	pages := map[int][]json.RawMessage{}
	order := []string{}
	for i := 0; i < book.PageCount; i++ {
		pages[i] = []json.RawMessage{}
	}
	for _, item := range book.Items {
		var meta struct {
			ID   string
			Page int
		}
		if err := json.Unmarshal(item, &meta); err != nil {
			return nil, nil, err
		}
		pages[meta.Page] = append(pages[meta.Page], item)
		order = append(order, meta.ID)
	}
	return pages, order, nil
}
func writePages(ctx context.Context, tx *sql.Tx, student, id string, book model.Notebook) error {
	pages, _, err := pagesOf(book)
	if err != nil {
		return err
	}
	for number := 0; number < book.PageCount; number++ {
		data, err := json.Marshal(pages[number])
		if err != nil {
			return err
		}
		_, err = builder.Insert("pages").Columns("student_id", "board_id", "number", "items").Values(student, id, number, string(data)).Suffix("ON CONFLICT(student_id,board_id,number) DO UPDATE SET items=EXCLUDED.items").RunWith(tx).ExecContext(ctx)
		if err != nil {
			return err
		}
	}
	_, err = builder.Delete("pages").Where(sq.Eq{"student_id": student, "board_id": id}).Where(sq.GtOrEq{"number": book.PageCount}).RunWith(tx).ExecContext(ctx)
	return err
}
func insertTopic(ctx context.Context, tx *sql.Tx, student string, t model.Topic, book model.Notebook) error {
	_, order, err := pagesOf(book)
	if err != nil {
		return err
	}
	data, _ := json.Marshal(order)
	_, err = builder.Insert("boards").Columns("student_id", "id", "title", "kind", "sort_order", "page_count", "revision", "item_order", "group_id").Values(student, t.ID, t.Title, t.Kind, t.SortOrder, book.PageCount, 0, string(data), nullableGroup(t.GroupID)).RunWith(tx).ExecContext(ctx)
	if err != nil {
		return translate(err)
	}
	return writePages(ctx, tx, student, t.ID, book)
}
func (s *Store) EnsureMain(ctx context.Context, student string) error {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err = lockOwner(ctx, tx, student); err != nil {
		return err
	}
	var n int
	if err = builder.Select("count(*)").From("boards").Where(sq.Eq{"student_id": student, "id": "main"}).RunWith(tx).QueryRowContext(ctx).Scan(&n); err != nil {
		return err
	}
	if n == 0 {
		err = insertTopic(ctx, tx, student, model.Topic{ID: "main", Title: "Текущий урок", Kind: "board", SortOrder: 0}, model.Notebook{Items: []json.RawMessage{}, PageCount: 3})
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}
func (s *Store) Topics(ctx context.Context, student string) ([]model.Topic, error) {
	rows, err := builder.Select("id", "title", "kind", "sort_order", "COALESCE(group_id,'')").From("boards").Where(sq.Eq{"student_id": student, "deleted_at": nil}).OrderBy("sort_order", "id").RunWith(s.DB).QueryContext(ctx)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []model.Topic{}
	for rows.Next() {
		var t model.Topic
		if err = rows.Scan(&t.ID, &t.Title, &t.Kind, &t.SortOrder, &t.GroupID); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}
func (s *Store) CreateTopic(ctx context.Context, student string, t model.Topic, book model.Notebook, doc *model.Document) error {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err = lockOwner(ctx, tx, student); err != nil {
		return err
	}
	if err = validGroup(ctx, tx, student, t.GroupID); err != nil {
		return err
	}
	var count, max int
	if err = builder.Select("count(*)", "COALESCE(max(sort_order),-1)").From("boards").Where(sq.Eq{"student_id": student, "deleted_at": nil}).RunWith(tx).QueryRowContext(ctx).Scan(&count, &max); err != nil {
		return err
	}
	if count >= 100 {
		return model.Bad("Можно создать до 100 досок.")
	}
	t.SortOrder = max + 1
	if err = insertTopic(ctx, tx, student, t, book); err != nil {
		return err
	}
	if doc != nil {
		_, err = builder.Insert("documents").Columns("student_id", "board_id", "asset_id", "name", "page_count").Values(student, t.ID, doc.AssetID, doc.Name, doc.PageCount).RunWith(tx).ExecContext(ctx)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}
func (s *Store) RenameTopic(ctx context.Context, student, id, title string) error {
	r, err := builder.Update("boards").Set("title", title).Where(sq.Eq{"student_id": student, "id": id, "deleted_at": nil}).RunWith(s.DB).ExecContext(ctx)
	if err != nil {
		return err
	}
	n, _ := r.RowsAffected()
	if n == 0 {
		return model.ErrNotFound
	}
	return nil
}
func (s *Store) DeleteTopic(ctx context.Context, student, id string) error {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err = lockOwner(ctx, tx, student); err != nil {
		return err
	}
	result, err := builder.Update("boards").Set("deleted_at", sq.Expr("CURRENT_TIMESTAMP")).Set("revision", sq.Expr("revision+1")).Where(sq.Eq{"student_id": student, "id": id, "deleted_at": nil}).Where(sq.NotEq{"id": "main"}).RunWith(tx).ExecContext(ctx)
	if err != nil {
		return err
	}
	count, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if count == 0 {
		return model.ErrNotFound
	}
	return tx.Commit()
}

func (s *Store) ReorderTopics(ctx context.Context, student string, ids []string) error {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err = lockOwner(ctx, tx, student); err != nil {
		return err
	}
	rows, err := builder.Select("id").From("boards").Where(sq.Eq{"student_id": student, "deleted_at": nil}).RunWith(tx).QueryContext(ctx)
	if err != nil {
		return err
	}
	existing := map[string]bool{}
	for rows.Next() {
		var id string
		if err = rows.Scan(&id); err != nil {
			rows.Close()
			return err
		}
		existing[id] = true
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return err
	}
	if len(ids) != len(existing) {
		return model.Bad("Проверьте порядок досок.")
	}
	for i, id := range ids {
		if !existing[id] {
			return model.Bad("Проверьте порядок досок.")
		}
		delete(existing, id)
		if _, err = builder.Update("boards").Set("sort_order", i).Where(sq.Eq{"student_id": student, "id": id}).RunWith(tx).ExecContext(ctx); err != nil {
			return err
		}
	}
	return tx.Commit()
}
func (s *Store) Board(ctx context.Context, student, id string) (model.Board, error) {
	var out model.Board
	tx, err := s.DB.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return out, err
	}
	defer tx.Rollback()
	var orderJSON []byte
	err = builder.Select("id", "title", "kind", "sort_order", "page_count", "revision", "item_order", "COALESCE(group_id,'')").From("boards").Where(sq.Eq{"student_id": student, "id": id, "deleted_at": nil}).RunWith(tx).QueryRowContext(ctx).Scan(&out.Topic.ID, &out.Topic.Title, &out.Topic.Kind, &out.Topic.SortOrder, &out.Notebook.PageCount, &out.Revision, &orderJSON, &out.Topic.GroupID)
	if err != nil {
		return out, translate(err)
	}
	rows, err := builder.Select("number", "items").From("pages").Where(sq.Eq{"student_id": student, "board_id": id}).OrderBy("number").RunWith(tx).QueryContext(ctx)
	if err != nil {
		return out, err
	}
	items := map[string]json.RawMessage{}
	count := 0
	for rows.Next() {
		var number int
		var data []byte
		if err = rows.Scan(&number, &data); err != nil {
			rows.Close()
			return out, err
		}
		var page []json.RawMessage
		if err = json.Unmarshal(data, &page); err != nil {
			rows.Close()
			return out, err
		}
		for _, item := range page {
			var meta struct{ ID string }
			if err = json.Unmarshal(item, &meta); err != nil {
				rows.Close()
				return out, err
			}
			items[meta.ID] = item
		}
		count++
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return out, err
	}
	if count != out.Notebook.PageCount {
		return out, fmt.Errorf("incomplete board page set")
	}
	var order []string
	if err = json.Unmarshal(orderJSON, &order); err != nil {
		return out, err
	}
	out.Notebook.Items = []json.RawMessage{}
	for _, key := range order {
		item, ok := items[key]
		if !ok {
			return out, fmt.Errorf("incomplete item order")
		}
		out.Notebook.Items = append(out.Notebook.Items, item)
	}
	if len(items) != len(order) {
		return out, fmt.Errorf("invalid item order")
	}
	return out, tx.Commit()
}
func (s *Store) SaveBoard(ctx context.Context, student, id string, book model.Notebook, revision int64) (int64, error) {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	var current int64
	err = builder.Select("revision").From("boards").Where(sq.Eq{"student_id": student, "id": id, "deleted_at": nil}).Suffix("FOR UPDATE").RunWith(tx).QueryRowContext(ctx).Scan(&current)
	if err != nil {
		return 0, translate(err)
	}
	if current != revision {
		return 0, model.ErrConflict
	}
	if err = writePages(ctx, tx, student, id, book); err != nil {
		return 0, err
	}
	_, order, err := pagesOf(book)
	if err != nil {
		return 0, err
	}
	data, _ := json.Marshal(order)
	if _, err = builder.Update("boards").Set("page_count", book.PageCount).Set("revision", current+1).Set("item_order", string(data)).Where(sq.Eq{"student_id": student, "id": id}).RunWith(tx).ExecContext(ctx); err != nil {
		return 0, err
	}
	return current + 1, tx.Commit()
}

// Deleted boards remain intact for seven days, but are never writable or visible to pupils.
func (s *Store) TrashTopics(ctx context.Context, student string) ([]model.DeletedTopic, error) {
	rows, err := s.DB.QueryContext(ctx, `SELECT id,title,kind,sort_order,deleted_at,deleted_at+INTERVAL '7 days',COALESCE(group_id,'') FROM boards WHERE student_id=$1 AND deleted_at>CURRENT_TIMESTAMP-INTERVAL '7 days' ORDER BY deleted_at DESC,id`, student)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []model.DeletedTopic{}
	for rows.Next() {
		var t model.DeletedTopic
		if err = rows.Scan(&t.ID, &t.Title, &t.Kind, &t.SortOrder, &t.DeletedAt, &t.ExpiresAt, &t.GroupID); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}
func (s *Store) RestoreTopic(ctx context.Context, student, id string) error {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err = lockOwner(ctx, tx, student); err != nil {
		return err
	}
	var count int
	if err = tx.QueryRowContext(ctx, "SELECT count(*) FROM boards WHERE student_id=$1 AND deleted_at IS NULL", student).Scan(&count); err != nil {
		return err
	}
	if count >= 100 {
		return model.Bad("Сначала освободите место: можно хранить до 100 активных досок.")
	}
	result, err := tx.ExecContext(ctx, `UPDATE boards SET deleted_at=NULL,revision=revision+1 WHERE student_id=$1 AND id=$2 AND deleted_at>CURRENT_TIMESTAMP-INTERVAL '7 days'`, student, id)
	if err != nil {
		return err
	}
	n, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return model.ErrNotFound
	}
	return tx.Commit()
}
func (s *Store) PurgeDeletedTopics(ctx context.Context) error {
	_, err := s.DB.ExecContext(ctx, `DELETE FROM boards WHERE id<>'main' AND deleted_at<=CURRENT_TIMESTAMP-INTERVAL '7 days'`)
	return err
}

package service

import (
	"context"
	"encoding/json"
	"ulianaa.math/backend/internal/model"
)

func ApplyBoardPatch(base model.Notebook, patch model.BoardPatch) (model.Notebook, error) {
	rows := map[string]json.RawMessage{}
	order := []string{}
	removed := map[string]bool{}
	updated := map[string]bool{}
	for _, id := range patch.Remove {
		if id == "" || removed[id] {
			return base, model.Bad("Некорректное удаление.")
		}
		removed[id] = true
	}
	for _, raw := range base.Items {
		var item struct{ ID string }
		if json.Unmarshal(raw, &item) != nil {
			return base, model.Bad("Некорректная доска.")
		}
		if !removed[item.ID] {
			rows[item.ID] = raw
			order = append(order, item.ID)
		}
	}
	for _, raw := range patch.Upsert {
		var item struct{ ID string }
		if json.Unmarshal(raw, &item) != nil || item.ID == "" || updated[item.ID] || removed[item.ID] {
			return base, model.Bad("Некорректный объект.")
		}
		updated[item.ID] = true
		if _, exists := rows[item.ID]; !exists {
			order = append(order, item.ID)
		}
		rows[item.ID] = raw
	}
	if patch.Order != nil {
		order = patch.Order
	}
	if len(order) != len(rows) {
		return base, model.Bad("Некорректный порядок доски.")
	}
	seen := map[string]bool{}
	book := model.Notebook{PageCount: patch.PageCount, Items: []json.RawMessage{}}
	for _, id := range order {
		raw, ok := rows[id]
		if !ok || seen[id] {
			return base, model.Bad("Некорректный порядок доски.")
		}
		seen[id] = true
		book.Items = append(book.Items, raw)
	}
	return book, ValidateNotebook(book)
}
func (s *Service) SaveBoardPatch(ctx context.Context, p model.Principal, id, topic string, patch model.BoardPatch, revision int64) (int64, error) {
	board, err := s.Board(ctx, p, id, topic)
	if err != nil {
		return 0, err
	}
	if board.Revision != revision {
		return 0, model.ErrConflict
	}
	book, err := ApplyBoardPatch(board.Notebook, patch)
	if err != nil {
		return 0, err
	}
	return s.SaveBoard(ctx, p, id, topic, book, revision)
}

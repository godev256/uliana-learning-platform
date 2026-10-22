package service

import (
	"bytes"
	"context"
	"encoding/json"
	"github.com/google/uuid"
	"math"
	"regexp"
	"strings"
	"ulianaa.math/backend/internal/model"
	"unicode/utf8"
)

func ValidateNotebook(book model.Notebook) error {
	if book.PageCount < 1 || book.PageCount > 100 || book.Items == nil || len(book.Items) > 10000 {
		return model.Bad("Проверьте листы доски.")
	}
	seen := map[string]bool{}
	size := 0
	for _, raw := range book.Items {
		var item struct {
			ID   string `json:"id"`
			Type string `json:"type"`
			Page *int   `json:"page"`
		}
		if err := json.Unmarshal(raw, &item); err != nil || item.ID == "" || len(item.ID) > 180 || item.Type == "" || len(item.Type) > 80 || item.Page == nil || *item.Page < 0 || *item.Page >= book.PageCount || seen[item.ID] {
			return model.Bad("Некорректный объект на доске.")
		}
		seen[item.ID] = true
		size += len(raw)
	}
	if size > 3200000 {
		return model.Bad("Доска слишком большая.")
	}
	return nil
}
func validTitle(title string) error {
	if utf8.RuneCountInString(title) < 1 || utf8.RuneCountInString(title) > 80 {
		return model.Bad("Название доски: от 1 до 80 символов.")
	}
	return nil
}
func (s *Service) CreateTopic(ctx context.Context, p model.Principal, id, title string, doc *model.Document) (model.Topic, error) {
	if err := Teacher(p); err != nil {
		return model.Topic{}, err
	}
	u, err := s.Owner(ctx, p, id)
	if err != nil {
		return model.Topic{}, err
	}
	title = strings.TrimSpace(title)
	if err = validTitle(title); err != nil {
		return model.Topic{}, err
	}
	if err = s.Boards.EnsureMain(ctx, u.ID); err != nil {
		return model.Topic{}, err
	}
	topic := model.Topic{ID: uuid.NewString(), Title: title, Kind: "board"}
	book := model.Notebook{PageCount: 1, Items: []json.RawMessage{}}
	if doc != nil {
		if doc.AssetID == "" || len(doc.AssetID) > 80 || doc.Name == "" || utf8.RuneCountInString(doc.Name) > 512 || doc.PageCount < 1 || doc.PageCount > 100 || len(doc.Pages) != doc.PageCount {
			return topic, model.Bad("Проверьте PDF.")
		}
		if err = s.CompletePDF(ctx, u.ID, doc.AssetID, 0); err != nil {
			return topic, err
		}
		topic.Kind = "pdf"
		book.PageCount = doc.PageCount
		for i, page := range doc.Pages {
			if page.AssetID != doc.AssetID+":page:"+itoa(i+1) || math.IsNaN(page.Width) || math.IsNaN(page.Height) || page.Width <= 0 || page.Height <= 0 || page.Width > 10000 || page.Height > 10000 {
				return topic, model.Bad("Проверьте страницы PDF.")
			}
			parts, err := s.Assets.AssetParts(ctx, u.ID, page.AssetID)
			if err != nil {
				return topic, err
			}
			if len(parts) != parts[0].Total || !strings.HasPrefix(parts[0].Mime, "image/") {
				return topic, model.Bad("Страница PDF загружена не полностью.")
			}
			ratio := math.Min(1600/page.Width, 2376/page.Height)
			width, height := page.Width*ratio, page.Height*ratio
			raw, _ := json.Marshal(map[string]any{"id": uuid.NewString(), "type": "image", "page": i, "color": "#212123", "size": 4, "assetId": page.AssetID, "background": true, "documentId": doc.AssetID, "sourcePage": i + 1, "points": [][]float64{{(1600 - width) / 2, 0}, {(1600 + width) / 2, height}}})
			book.Items = append(book.Items, raw)
		}
	}
	if err = s.Boards.CreateTopic(ctx, u.ID, topic, book, doc); err != nil {
		return topic, err
	}
	return topic, nil
}
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	buf := [20]byte{}
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}
func (s *Service) RenameTopic(ctx context.Context, p model.Principal, id, topic, title string) error {
	if err := Teacher(p); err != nil {
		return err
	}
	u, err := s.Owner(ctx, p, id)
	if err != nil {
		return err
	}
	title = strings.TrimSpace(title)
	if err = validTitle(title); err != nil {
		return err
	}
	return s.Boards.RenameTopic(ctx, u.ID, topic, title)
}
func (s *Service) DeleteTopic(ctx context.Context, p model.Principal, id, topic string) error {
	if err := Teacher(p); err != nil {
		return err
	}
	owner, err := s.Owner(ctx, p, id)
	if err != nil {
		return err
	}
	if topic == "main" {
		return model.Bad("Основная доска должна остаться.")
	}
	return s.Boards.DeleteTopic(ctx, owner.ID, topic)
}

func (s *Service) ReorderTopics(ctx context.Context, p model.Principal, id string, ids []string) error {
	if err := Teacher(p); err != nil {
		return err
	}
	u, err := s.Owner(ctx, p, id)
	if err != nil {
		return err
	}
	return s.Boards.ReorderTopics(ctx, u.ID, ids)
}

var assetRE = regexp.MustCompile(`^[a-zA-Z0-9_.:-]{1,180}$`)

func (s *Service) PutAsset(ctx context.Context, p model.Principal, id, asset string, part, total int, mime string, data []byte) error {
	u, err := s.Owner(ctx, p, id)
	if err != nil {
		return err
	}
	if !assetRE.MatchString(asset) || total < 1 || total > 200 || part < 0 || part >= total || mime == "" || len(mime) > 150 || len(data) == 0 || len(data) > 262500 {
		return model.Bad("Некорректный файл.")
	}
	return s.Assets.PutAsset(ctx, u.ID, asset, part, model.Asset{Data: data, Total: total, Mime: mime})
}
func (s *Service) Asset(ctx context.Context, p model.Principal, id, asset string, part int) (model.Asset, error) {
	u, err := s.Owner(ctx, p, id)
	if err != nil {
		return model.Asset{}, err
	}
	if !assetRE.MatchString(asset) || part < 0 || part >= 200 {
		return model.Asset{}, model.Bad("Некорректный файл.")
	}
	return s.Assets.Asset(ctx, u.ID, asset, part)
}
func (s *Service) CompletePDF(ctx context.Context, student, asset string, expected int) error {
	parts, err := s.Assets.AssetParts(ctx, student, asset)
	if err != nil {
		return err
	}
	if len(parts) != parts[0].Total || parts[0].Mime != "application/pdf" || !bytes.HasPrefix(parts[0].Data, []byte("%PDF-")) {
		return model.Bad("PDF загружен не полностью.")
	}
	size := 0
	for _, part := range parts {
		if part.Mime != parts[0].Mime || part.Total != len(parts) {
			return model.Bad("Некорректный PDF.")
		}
		size += len(part.Data)
	}
	if size > 20*1024*1024 || (expected > 0 && size != expected) {
		return model.Bad("Проверьте размер PDF.")
	}
	return nil
}

func (s *Service) TrashTopics(ctx context.Context, p model.Principal, id string) ([]model.DeletedTopic, error) {
	if err := Teacher(p); err != nil {
		return nil, err
	}
	owner, err := s.Owner(ctx, p, id)
	if err != nil {
		return nil, err
	}
	return s.Boards.TrashTopics(ctx, owner.ID)
}
func (s *Service) RestoreTopic(ctx context.Context, p model.Principal, id, topic string) error {
	if err := Teacher(p); err != nil {
		return err
	}
	owner, err := s.Owner(ctx, p, id)
	if err != nil {
		return err
	}
	if topic == "main" {
		return model.Bad("Основная доска уже доступна.")
	}
	return s.Boards.RestoreTopic(ctx, owner.ID, topic)
}

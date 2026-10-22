package service

import (
	"context"
	"github.com/google/uuid"
	"strings"
	"ulianaa.math/backend/internal/model"
)

func (s *Service) Groups(ctx context.Context, p model.Principal, id string) ([]model.BoardGroup, error) {
	u, err := s.Owner(ctx, p, id)
	if err != nil {
		return nil, err
	}
	return s.Boards.Groups(ctx, u.ID)
}
func (s *Service) CreateGroup(ctx context.Context, p model.Principal, id, title string) (model.BoardGroup, error) {
	if err := Teacher(p); err != nil {
		return model.BoardGroup{}, err
	}
	u, err := s.Owner(ctx, p, id)
	if err != nil {
		return model.BoardGroup{}, err
	}
	title = strings.TrimSpace(title)
	if err = validTitle(title); err != nil {
		return model.BoardGroup{}, err
	}
	g := model.BoardGroup{ID: uuid.NewString(), Title: title}
	return g, s.Boards.CreateGroup(ctx, u.ID, g)
}
func (s *Service) RenameGroup(ctx context.Context, p model.Principal, id, group, title string) error {
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
	return s.Boards.RenameGroup(ctx, u.ID, group, title)
}
func (s *Service) DeleteGroup(ctx context.Context, p model.Principal, id, group string) error {
	if err := Teacher(p); err != nil {
		return err
	}
	u, err := s.Owner(ctx, p, id)
	if err != nil {
		return err
	}
	return s.Boards.DeleteGroup(ctx, u.ID, group)
}
func (s *Service) MoveTopic(ctx context.Context, p model.Principal, id, topic, group string) error {
	if err := Teacher(p); err != nil {
		return err
	}
	u, err := s.Owner(ctx, p, id)
	if err != nil {
		return err
	}
	if topic == "main" {
		return model.Bad("Текущий урок остаётся вне групп.")
	}
	return s.Boards.MoveTopic(ctx, u.ID, topic, group)
}

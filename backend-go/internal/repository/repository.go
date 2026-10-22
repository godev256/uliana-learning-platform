package repository

import (
	"context"
	"encoding/json"
	"time"
	"ulianaa.math/backend/internal/model"
)

type Users interface {
	UserByLogin(context.Context, string) (model.User, error)
	UserByID(context.Context, string) (model.User, error)
	HasTeacher(context.Context) (bool, error)
	CreateUser(context.Context, model.User) error
	ListStudents(context.Context) ([]model.User, error)
	ResetPassword(context.Context, string, string) error
}
type Sessions interface {
	CreateSession(context.Context, model.Session) error
	SessionUser(context.Context, string, time.Time) (model.User, error)
	DeleteSession(context.Context, string) error
	Attempt(context.Context, string, time.Time, int) error
	ClearAttempt(context.Context, string) error
}
type Boards interface {
	EnsureMain(context.Context, string) error
	Topics(context.Context, string) ([]model.Topic, error)
	Groups(context.Context, string) ([]model.BoardGroup, error)
	CreateGroup(context.Context, string, model.BoardGroup) error
	RenameGroup(context.Context, string, string, string) error
	DeleteGroup(context.Context, string, string) error
	MoveTopic(context.Context, string, string, string) error
	CreateTopic(context.Context, string, model.Topic, model.Notebook, *model.Document) error
	RenameTopic(context.Context, string, string, string) error
	DeleteTopic(context.Context, string, string) error
	TrashTopics(context.Context, string) ([]model.DeletedTopic, error)
	RestoreTopic(context.Context, string, string) error
	PurgeDeletedTopics(context.Context) error
	ReorderTopics(context.Context, string, []string) error
	Board(context.Context, string, string) (model.Board, error)
	SaveBoard(context.Context, string, string, model.Notebook, int64) (int64, error)
}
type Assets interface {
	PutAsset(context.Context, string, string, int, model.Asset) error
	Asset(context.Context, string, string, int) (model.Asset, error)
	AssetParts(context.Context, string, string) ([]model.Asset, error)
}
type Profiles interface {
	Profile(context.Context, string) (model.Profile, error)
	SaveProfile(context.Context, string, json.RawMessage, json.RawMessage, json.RawMessage) error
}

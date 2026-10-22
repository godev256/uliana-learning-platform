package model

import (
	"encoding/json"
	"errors"
	"time"
)

type Error struct {
	Status  int
	Message string
}

func (e *Error) Error() string { return e.Message }
func Bad(message string) error { return &Error{400, message} }

var (
	ErrUnauthorized = &Error{401, "Войдите в кабинет."}
	ErrCredentials  = &Error{401, "Неверный логин или пароль."}
	ErrForbidden    = &Error{403, "Этот кабинет вам недоступен."}
	ErrNotFound     = &Error{404, "Запись не найдена."}
	ErrConflict     = &Error{409, "Доска изменена в другом окне. Повторите сохранение."}
	ErrExists       = &Error{409, "Такая запись уже существует."}
	ErrLimited      = &Error{429, "Слишком много попыток. Повторите позже."}
)

func Status(err error) (int, string) {
	var e *Error
	if errors.As(err, &e) {
		return e.Status, e.Message
	}
	return 500, "Не удалось выполнить действие."
}

type User struct {
	ID           string `json:"id"`
	Login        string `json:"login"`
	Role         string `json:"role"`
	CreatedAt    int64  `json:"created_at,omitempty"`
	PasswordHash string `json:"-"`
}
type Session struct {
	ID        string
	UserID    string
	ExpiresAt time.Time
}
type Principal struct {
	User      User
	SessionID string
}
type LoginResult struct {
	User        User   `json:"user"`
	AccessToken string `json:"accessToken"`
	TokenType   string `json:"tokenType"`
	ExpiresIn   int64  `json:"expiresIn"`
}
type Notebook struct {
	Items     []json.RawMessage `json:"items"`
	PageCount int               `json:"pageCount"`
}
type Topic struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Kind      string `json:"kind"`
	SortOrder int    `json:"sort_order"`
}
type DeletedTopic struct {
	Topic
	DeletedAt time.Time `json:"deletedAt"`
	ExpiresAt time.Time `json:"expiresAt"`
}
type Board struct {
	Student  User     `json:"student"`
	Topic    Topic    `json:"topic"`
	Notebook Notebook `json:"notebook"`
	Revision int64    `json:"revision"`
}
type Asset struct {
	Data  []byte
	Total int
	Mime  string
}
type DocumentPage struct {
	AssetID string  `json:"assetId"`
	Width   float64 `json:"width"`
	Height  float64 `json:"height"`
}
type Document struct {
	AssetID   string         `json:"assetId"`
	Name      string         `json:"name"`
	PageCount int            `json:"pageCount"`
	Pages     []DocumentPage `json:"pages"`
}
type Profile struct {
	Student  User            `json:"student"`
	Schedule json.RawMessage `json:"schedule"`
	Lessons  json.RawMessage `json:"lessons"`
	Calendar json.RawMessage `json:"calendar"`
}

// Import-only DTOs are never returned by the HTTP API.
type ImportUser struct {
	ID           string `json:"id"`
	Login        string `json:"login"`
	Role         string `json:"role"`
	CreatedAt    int64  `json:"createdAt"`
	PasswordHash string `json:"passwordHash"`
}
type ImportBoard struct {
	StudentID string    `json:"studentId"`
	Topic     Topic     `json:"topic"`
	Notebook  Notebook  `json:"notebook"`
	Revision  int64     `json:"revision"`
	Document  *Document `json:"document,omitempty"`
}
type ImportProfile struct {
	StudentID string          `json:"studentId"`
	Schedule  json.RawMessage `json:"schedule"`
	Lessons   json.RawMessage `json:"lessons"`
	Calendar  json.RawMessage `json:"calendar"`
}
type ImportAsset struct {
	StudentID string `json:"studentId"`
	ID        string `json:"id"`
	Part      int    `json:"part"`
	Total     int    `json:"total"`
	Mime      string `json:"mime"`
	Data      []byte `json:"data"`
}
type Snapshot struct {
	Version  int             `json:"version"`
	Users    []ImportUser    `json:"users"`
	Boards   []ImportBoard   `json:"boards"`
	Profiles []ImportProfile `json:"profiles"`
	Assets   []ImportAsset   `json:"assets"`
}

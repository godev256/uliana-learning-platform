package service

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"github.com/google/uuid"
	"regexp"
	"strings"
	"time"
	"ulianaa.math/backend/internal/auth"
	"ulianaa.math/backend/internal/model"
	"ulianaa.math/backend/internal/repository"
	"unicode/utf8"
)

type Service struct {
	Users    repository.Users
	Sessions repository.Sessions
	Boards   repository.Boards
	Assets   repository.Assets
	Profiles repository.Profiles
	Tokens   auth.Tokens
}

var loginRE = regexp.MustCompile(`^[a-z0-9][a-z0-9_.-]{2,31}$`)

func credentials(login, password string) error {
	if !loginRE.MatchString(login) || utf8.RuneCountInString(password) < 10 || utf8.RuneCountInString(password) > 128 {
		return model.Bad("Логин: 3–32 латинских символа. Пароль: 10–128 символов.")
	}
	return nil
}
func Teacher(p model.Principal) error {
	if p.User.Role != "teacher" {
		return model.ErrForbidden
	}
	return nil
}
func (s *Service) Setup(ctx context.Context, login, password string) (model.User, error) {
	exists, err := s.Users.HasTeacher(ctx)
	if err != nil {
		return model.User{}, err
	}
	if exists {
		return model.User{}, model.ErrExists
	}
	return s.createUser(ctx, login, password, "teacher")
}
func (s *Service) createUser(ctx context.Context, login, password, role string) (model.User, error) {
	login = strings.ToLower(strings.TrimSpace(login))
	if err := credentials(login, password); err != nil {
		return model.User{}, err
	}
	hash, err := auth.HashPassword(password)
	if err != nil {
		return model.User{}, err
	}
	u := model.User{ID: uuid.NewString(), Login: login, Role: role, CreatedAt: time.Now().UnixMilli(), PasswordHash: hash}
	err = s.Users.CreateUser(ctx, u)
	return u, err
}
func (s *Service) CreateStudent(ctx context.Context, p model.Principal, login, password string) (model.User, error) {
	if err := Teacher(p); err != nil {
		return model.User{}, err
	}
	return s.createUser(ctx, login, password, "student")
}
func (s *Service) Login(ctx context.Context, login, password, ip string) (model.LoginResult, error) {
	login = strings.ToLower(strings.TrimSpace(login))
	var out model.LoginResult
	if err := credentials(login, password); err != nil {
		return out, model.ErrCredentials
	}
	now := time.Now()
	key := fmt.Sprintf("%x", sha256.Sum256([]byte("login:"+login)))
	ipKey := fmt.Sprintf("%x", sha256.Sum256([]byte("ip:"+ip)))
	if err := s.Sessions.Attempt(ctx, ipKey, now, 80); err != nil {
		return out, err
	}
	if err := s.Sessions.Attempt(ctx, key, now, 12); err != nil {
		return out, err
	}
	user, err := s.Users.UserByLogin(ctx, login)
	if err != nil && !errors.Is(err, model.ErrNotFound) {
		return out, err
	}
	valid := auth.CheckPassword(password, user.PasswordHash)
	if !valid || err != nil {
		return out, model.ErrCredentials
	}
	token, id, expires, err := s.Tokens.Issue(user.ID, now)
	if err != nil {
		return out, err
	}
	if err = s.Sessions.CreateSession(ctx, model.Session{ID: id, UserID: user.ID, ExpiresAt: expires}); err != nil {
		return out, err
	}
	if err = s.Sessions.ClearAttempt(ctx, key); err != nil {
		return out, err
	}
	return model.LoginResult{User: user, AccessToken: token, TokenType: "Bearer", ExpiresIn: int64(s.Tokens.TTL.Seconds())}, nil
}
func (s *Service) Authenticate(ctx context.Context, token string) (model.Principal, error) {
	claims, err := s.Tokens.Parse(token)
	if err != nil {
		return model.Principal{}, model.ErrUnauthorized
	}
	user, err := s.Sessions.SessionUser(ctx, claims.ID, time.Now())
	if errors.Is(err, model.ErrNotFound) {
		return model.Principal{}, model.ErrUnauthorized
	}
	if err != nil {
		return model.Principal{}, err
	}
	if user.ID != claims.Subject {
		return model.Principal{}, model.ErrUnauthorized
	}
	return model.Principal{User: user, SessionID: claims.ID}, nil
}
func (s *Service) Student(ctx context.Context, p model.Principal, id string) (model.User, error) {
	if p.User.Role == "student" {
		if id != "" && id != p.User.ID {
			return model.User{}, model.ErrForbidden
		}
		id = p.User.ID
	}
	if id == "" {
		return model.User{}, model.ErrNotFound
	}
	u, err := s.Users.UserByID(ctx, id)
	if err != nil {
		return u, err
	}
	if u.Role != "student" {
		return model.User{}, model.ErrNotFound
	}
	return u, nil
}
func (s *Service) Students(ctx context.Context, p model.Principal) ([]model.User, error) {
	if err := Teacher(p); err != nil {
		return nil, err
	}
	return s.Users.ListStudents(ctx)
}
func (s *Service) ResetPassword(ctx context.Context, p model.Principal, id, password string) error {
	if err := Teacher(p); err != nil {
		return err
	}
	u, err := s.Student(ctx, p, id)
	if err != nil {
		return err
	}
	if err = credentials(u.Login, password); err != nil {
		return err
	}
	hash, err := auth.HashPassword(password)
	if err != nil {
		return err
	}
	return s.Users.ResetPassword(ctx, u.ID, hash)
}

// Owner permits the teacher's own workspace as well as authorized student boards.
func (s *Service) Owner(ctx context.Context, p model.Principal, id string) (model.User, error) {
	if p.User.Role == "teacher" && id == p.User.ID {
		return s.Users.UserByID(ctx, id)
	}
	return s.Student(ctx, p, id)
}
func (s *Service) Topics(ctx context.Context, p model.Principal, id string) ([]model.Topic, error) {
	u, err := s.Owner(ctx, p, id)
	if err != nil {
		return nil, err
	}
	if err = s.Boards.EnsureMain(ctx, u.ID); err != nil {
		return nil, err
	}
	return s.Boards.Topics(ctx, u.ID)
}
func (s *Service) Board(ctx context.Context, p model.Principal, id, topic string) (model.Board, error) {
	u, err := s.Owner(ctx, p, id)
	if err != nil {
		return model.Board{}, err
	}
	if err = s.Boards.EnsureMain(ctx, u.ID); err != nil {
		return model.Board{}, err
	}
	if topic == "" {
		topic = "main"
	}
	book, err := s.Boards.Board(ctx, u.ID, topic)
	book.Student = u
	return book, err
}

// WaitBoardRevision waits for a new revision without loading unchanged page contents.
// Scope is authorized before waiting; each revision query still excludes deleted boards.
func (s *Service) WaitBoardRevision(ctx context.Context, p model.Principal, id, topic string, since int64) (*int64, error) {
	u, err := s.Owner(ctx, p, id)
	if err != nil {
		return nil, err
	}
	if topic == "" {
		topic = "main"
	}
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	deadline := time.NewTimer(10 * time.Second)
	defer deadline.Stop()
	for {
		revision, err := s.Boards.BoardRevision(ctx, u.ID, topic)
		if err != nil {
			return nil, err
		}
		if revision != since {
			return &revision, nil
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-deadline.C:
			return nil, nil
		case <-ticker.C:
		}
	}
}
func (s *Service) SaveBoard(ctx context.Context, p model.Principal, id, topic string, book model.Notebook, revision int64) (int64, error) {
	u, err := s.Owner(ctx, p, id)
	if err != nil {
		return 0, err
	}
	if err = ValidateNotebook(book); err != nil {
		return 0, err
	}
	if revision < 0 {
		return 0, model.Bad("Некорректная ревизия.")
	}
	if topic == "" {
		topic = "main"
	}
	return s.Boards.SaveBoard(ctx, u.ID, topic, book, revision)
}

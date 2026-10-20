package postgres

import (
	"context"
	"database/sql"
	"errors"
	sq "github.com/Masterminds/squirrel"
	"github.com/jackc/pgx/v5/pgconn"
	_ "github.com/jackc/pgx/v5/stdlib"
	"time"
	"ulianaa.math/backend/internal/model"
)

var builder = sq.StatementBuilder.PlaceholderFormat(sq.Dollar)

type Store struct{ DB *sql.DB }

func Open(ctx context.Context, url string) (*Store, error) {
	db, err := sql.Open("pgx", url)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)
	if err = db.PingContext(ctx); err != nil {
		db.Close()
		return nil, err
	}
	return &Store{db}, nil
}
func translate(err error) error {
	if errors.Is(err, sql.ErrNoRows) {
		return model.ErrNotFound
	}
	var pg *pgconn.PgError
	if errors.As(err, &pg) && pg.Code == "23505" {
		return model.ErrExists
	}
	return err
}

type scanner interface{ Scan(...any) error }

func userScan(row scanner) (u model.User, err error) {
	err = row.Scan(&u.ID, &u.Login, &u.Role, &u.CreatedAt, &u.PasswordHash)
	return u, translate(err)
}

var userCols = []string{"id", "login", "role", "created_at", "password_hash"}

func (s *Store) UserByLogin(ctx context.Context, login string) (model.User, error) {
	return userScan(builder.Select(userCols...).From("users").Where(sq.Eq{"login": login}).RunWith(s.DB).QueryRowContext(ctx))
}
func (s *Store) UserByID(ctx context.Context, id string) (model.User, error) {
	return userScan(builder.Select(userCols...).From("users").Where(sq.Eq{"id": id}).RunWith(s.DB).QueryRowContext(ctx))
}
func (s *Store) HasTeacher(ctx context.Context) (bool, error) {
	var count int
	err := builder.Select("count(*)").From("users").Where(sq.Eq{"role": "teacher"}).RunWith(s.DB).QueryRowContext(ctx).Scan(&count)
	return count > 0, err
}
func (s *Store) CreateUser(ctx context.Context, u model.User) error {
	_, err := builder.Insert("users").Columns("id", "login", "role", "created_at", "password_hash").Values(u.ID, u.Login, u.Role, u.CreatedAt, u.PasswordHash).RunWith(s.DB).ExecContext(ctx)
	return translate(err)
}
func (s *Store) ListStudents(ctx context.Context) ([]model.User, error) {
	rows, err := builder.Select(userCols...).From("users").Where(sq.Eq{"role": "student"}).OrderBy("created_at DESC", "id").RunWith(s.DB).QueryContext(ctx)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []model.User{}
	for rows.Next() {
		u, err := userScan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}
func (s *Store) ResetPassword(ctx context.Context, id, password string) error {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	r, err := builder.Update("users").Set("password_hash", password).Where(sq.Eq{"id": id}).RunWith(tx).ExecContext(ctx)
	if err != nil {
		return err
	}
	n, _ := r.RowsAffected()
	if n == 0 {
		return model.ErrNotFound
	}
	if _, err = builder.Delete("sessions").Where(sq.Eq{"user_id": id}).RunWith(tx).ExecContext(ctx); err != nil {
		return err
	}
	return tx.Commit()
}
func (s *Store) CreateSession(ctx context.Context, v model.Session) error {
	_, err := builder.Insert("sessions").Columns("id", "user_id", "expires_at").Values(v.ID, v.UserID, v.ExpiresAt).RunWith(s.DB).ExecContext(ctx)
	return err
}
func (s *Store) SessionUser(ctx context.Context, id string, now time.Time) (model.User, error) {
	cols := []string{"u.id", "u.login", "u.role", "u.created_at", "u.password_hash"}
	return userScan(builder.Select(cols...).From("users u").Join("sessions s ON u.id=s.user_id").Where(sq.Eq{"s.id": id}).Where(sq.Gt{"s.expires_at": now}).RunWith(s.DB).QueryRowContext(ctx))
}
func (s *Store) DeleteSession(ctx context.Context, id string) error {
	_, err := builder.Delete("sessions").Where(sq.Eq{"id": id}).RunWith(s.DB).ExecContext(ctx)
	return err
}
func (s *Store) Attempt(ctx context.Context, key string, now time.Time, limit int) error {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = builder.Insert("login_attempts").Columns("key", "attempts", "reset_at").Values(key, 0, now.Add(15*time.Minute)).Suffix("ON CONFLICT (key) DO NOTHING").RunWith(tx).ExecContext(ctx); err != nil {
		return err
	}
	var count int
	var reset time.Time
	err = builder.Select("attempts", "reset_at").From("login_attempts").Where(sq.Eq{"key": key}).Suffix("FOR UPDATE").RunWith(tx).QueryRowContext(ctx).Scan(&count, &reset)
	if err != nil {
		return err
	}
	if !reset.After(now) {
		count = 0
		reset = now.Add(15 * time.Minute)
	}
	count++
	if _, err = builder.Update("login_attempts").Set("attempts", count).Set("reset_at", reset).Where(sq.Eq{"key": key}).RunWith(tx).ExecContext(ctx); err != nil {
		return err
	}
	if err = tx.Commit(); err != nil {
		return err
	}
	if count > limit {
		return model.ErrLimited
	}
	return nil
}
func (s *Store) ClearAttempt(ctx context.Context, key string) error {
	_, err := builder.Delete("login_attempts").Where(sq.Eq{"key": key}).RunWith(s.DB).ExecContext(ctx)
	return err
}

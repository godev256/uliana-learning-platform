package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/scrypt"
	"strings"
	"time"
)

var passwordSlots = make(chan struct{}, 4)

// Keep scrypt-v2 compatibility with existing local account hashes.
func HashPassword(password string) (string, error) {
	passwordSlots <- struct{}{}
	defer func() { <-passwordSlots }()
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	encoded := hex.EncodeToString(salt)
	key, err := scrypt.Key([]byte(password), []byte(encoded), 32768, 8, 3, 64)
	if err != nil {
		return "", err
	}
	return "scrypt-v2:" + encoded + ":" + hex.EncodeToString(key), nil
}
func CheckPassword(password, encoded string) bool {
	passwordSlots <- struct{}{}
	defer func() { <-passwordSlots }()
	parts := strings.Split(encoded, ":")
	if len(parts) != 3 || parts[0] != "scrypt-v2" {
		parts = []string{"scrypt-v2", strings.Repeat("0", 32), strings.Repeat("0", 128)}
	}
	expected, err := hex.DecodeString(parts[2])
	if err != nil || len(expected) != 64 {
		return false
	}
	candidate, err := scrypt.Key([]byte(password), []byte(parts[1]), 32768, 8, 3, 64)
	return err == nil && subtle.ConstantTimeCompare(candidate, expected) == 1
}

type Tokens struct {
	Key      []byte
	Issuer   string
	Audience string
	TTL      time.Duration
}

func (t Tokens) Issue(userID string, now time.Time) (string, string, time.Time, error) {
	id := uuid.NewString()
	expires := now.Add(t.TTL)
	claims := jwt.RegisteredClaims{Issuer: t.Issuer, Audience: jwt.ClaimStrings{t.Audience}, Subject: userID, ID: id, IssuedAt: jwt.NewNumericDate(now), NotBefore: jwt.NewNumericDate(now), ExpiresAt: jwt.NewNumericDate(expires)}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(t.Key)
	return token, id, expires, err
}
func (t Tokens) Parse(raw string) (jwt.RegisteredClaims, error) {
	claims := jwt.RegisteredClaims{}
	_, err := jwt.ParseWithClaims(raw, &claims, func(token *jwt.Token) (any, error) { return t.Key, nil }, jwt.WithValidMethods([]string{"HS256"}), jwt.WithIssuer(t.Issuer), jwt.WithAudience(t.Audience), jwt.WithExpirationRequired(), jwt.WithIssuedAt(), jwt.WithLeeway(5*time.Second))
	if err == nil && (claims.Subject == "" || claims.ID == "") {
		err = fmt.Errorf("missing token identity")
	}
	return claims, err
}

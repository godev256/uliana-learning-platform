package auth

import (
	"github.com/golang-jwt/jwt/v5"
	"strings"
	"testing"
	"time"
)

func TestPasswordCompatibility(t *testing.T) {
	hash, err := HashPassword("Correct-horse-123")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(hash, "scrypt-v2:") || !CheckPassword("Correct-horse-123", hash) || CheckPassword("Wrong-password-123", hash) {
		t.Fatal("password verification failed")
	}
	if CheckPassword("Any-password-123", "broken") {
		t.Fatal("malformed hash accepted")
	}
}
func TestJWTRejectsWrongAlgorithmIssuerAudienceAndExpiry(t *testing.T) {
	tokens := Tokens{Key: []byte(strings.Repeat("x", 32)), Issuer: "test", Audience: "frontend", TTL: time.Hour}
	raw, _, _, err := tokens.Issue("user-1", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if _, err = tokens.Parse(raw); err != nil {
		t.Fatal(err)
	}
	for _, test := range []struct {
		name             string
		method           jwt.SigningMethod
		issuer, audience string
		expiry           time.Time
	}{{"algorithm", jwt.SigningMethodHS512, "test", "frontend", time.Now().Add(time.Hour)}, {"issuer", jwt.SigningMethodHS256, "other", "frontend", time.Now().Add(time.Hour)}, {"audience", jwt.SigningMethodHS256, "test", "other", time.Now().Add(time.Hour)}, {"expiry", jwt.SigningMethodHS256, "test", "frontend", time.Now().Add(-time.Hour)}} {
		t.Run(test.name, func(t *testing.T) {
			claims := jwt.RegisteredClaims{Subject: "user-1", ID: "session-1", Issuer: test.issuer, Audience: jwt.ClaimStrings{test.audience}, ExpiresAt: jwt.NewNumericDate(test.expiry)}
			raw, _ := jwt.NewWithClaims(test.method, claims).SignedString(tokens.Key)
			if _, err := tokens.Parse(raw); err == nil {
				t.Fatal("invalid JWT accepted")
			}
		})
	}
}

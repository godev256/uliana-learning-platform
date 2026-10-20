package handler

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"testing"
	"ulianaa.math/backend/internal/config"
)

func TestClientIPTrustBoundary(t *testing.T) {
	h := Handler{Config: config.Config{TrustedProxies: []netip.Prefix{netip.MustParsePrefix("172.30.50.10/32")}}}
	for _, tc := range []struct{ peer, header, want string }{
		{"172.30.50.10:1234", "198.51.100.5", "198.51.100.5"},
		{"198.51.100.9:1234", "198.51.100.5", "198.51.100.9"},
		{"172.30.50.10:1234", "invalid", "172.30.50.10"},
		{"[::ffff:172.30.50.10]:1234", "2001:db8::5", "2001:db8::5"},
	} {
		r := httptest.NewRequest("POST", "/api/v1/auth/login", nil)
		r.RemoteAddr = tc.peer
		r.Header.Set("X-Real-IP", tc.header)
		if got := h.clientIP(r); got != tc.want {
			t.Errorf("peer %s: got %s, want %s", tc.peer, got, tc.want)
		}
	}
}
func TestCredentialedCORSOnlyForAllowedOrigin(t *testing.T) {
	h := Handler{Config: config.Config{Origins: []string{"https://ulianaa-learning.pro"}}, Log: slog.New(slog.NewTextHandler(io.Discard, nil))}
	for _, origin := range []string{"https://ulianaa-learning.pro", "https://evil.example"} {
		r := httptest.NewRequest(http.MethodOptions, "/api/v1/auth/login", nil)
		r.Header.Set("Origin", origin)
		w := httptest.NewRecorder()
		h.Routes().ServeHTTP(w, r)
		if origin == "https://ulianaa-learning.pro" {
			if w.Code != 204 || w.Header().Get("Access-Control-Allow-Origin") != origin || w.Header().Get("Access-Control-Allow-Credentials") != "true" {
				t.Fatalf("allowed origin: %d %v", w.Code, w.Header())
			}
		} else if w.Code != 403 || w.Header().Get("Access-Control-Allow-Origin") != "" {
			t.Fatalf("untrusted origin: %d %v", w.Code, w.Header())
		}
	}
}

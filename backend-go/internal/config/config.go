package config

import (
	"fmt"
	"net"
	"net/netip"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Address        string
	DatabaseURL    string
	Secret         string
	Issuer         string
	Audience       string
	TTL            time.Duration
	Origins        []string
	SecureCookie   bool
	LocalSetup     bool
	TrustedProxies []netip.Prefix
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
func Load() (Config, error) {
	c := Config{Address: env("HTTP_ADDR", "127.0.0.1:8081"), DatabaseURL: os.Getenv("DATABASE_URL"), Secret: os.Getenv("JWT_SECRET"), Issuer: env("JWT_ISSUER", "ulianaa.math.local"), Audience: env("JWT_AUDIENCE", "ulianaa.math.frontend"), Origins: strings.Split(env("ALLOWED_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173"), ",")}
	var err error
	if c.DatabaseURL == "" {
		return c, fmt.Errorf("DATABASE_URL is required")
	}
	if len(c.Secret) < 32 {
		return c, fmt.Errorf("JWT_SECRET must contain at least 32 bytes")
	}
	c.TTL, err = time.ParseDuration(env("JWT_TTL", "8h"))
	if err != nil || c.TTL <= 0 || c.TTL > 7*24*time.Hour {
		return c, fmt.Errorf("JWT_TTL must be between 1ns and 168h")
	}
	c.SecureCookie, err = strconv.ParseBool(env("COOKIE_SECURE", "false"))
	if err != nil {
		return c, fmt.Errorf("invalid COOKIE_SECURE")
	}
	c.LocalSetup, err = strconv.ParseBool(env("ALLOW_LOCAL_SETUP", "false"))
	if err != nil {
		return c, fmt.Errorf("invalid ALLOW_LOCAL_SETUP")
	}
	for i, origin := range c.Origins {
		c.Origins[i] = strings.TrimSpace(origin)
		u, err := url.Parse(c.Origins[i])
		if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") || u.Path != "" {
			return c, fmt.Errorf("invalid ALLOWED_ORIGINS")
		}
	}
	for _, value := range strings.Split(os.Getenv("TRUSTED_PROXY_CIDRS"), ",") {
		if strings.TrimSpace(value) == "" {
			continue
		}
		prefix, parseErr := netip.ParsePrefix(strings.TrimSpace(value))
		if parseErr != nil {
			return c, fmt.Errorf("invalid TRUSTED_PROXY_CIDRS")
		}
		c.TrustedProxies = append(c.TrustedProxies, prefix)
	}
	host, _, err := net.SplitHostPort(c.Address)
	if err != nil {
		return c, fmt.Errorf("invalid HTTP_ADDR")
	}
	if c.LocalSetup && (net.ParseIP(host) == nil || !net.ParseIP(host).IsLoopback()) {
		return c, fmt.Errorf("local setup requires a loopback listen address")
	}
	return c, nil
}

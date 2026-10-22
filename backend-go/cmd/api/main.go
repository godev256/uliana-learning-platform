package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
	"ulianaa.math/backend/internal/auth"
	"ulianaa.math/backend/internal/config"
	"ulianaa.math/backend/internal/handler"
	"ulianaa.math/backend/internal/repository/postgres"
	"ulianaa.math/backend/internal/service"
	"ulianaa.math/backend/migrations"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(log); err != nil {
		log.Error("API stopped", "error", err)
		os.Exit(1)
	}
}
func run(log *slog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	store, err := postgres.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer store.DB.Close()
	if err = migrations.Apply(ctx, store.DB); err != nil {
		return err
	}
	// Clean up on startup and every minute, even when no one opens the cabinet.
	cleanupCtx, stopCleanup := context.WithCancel(context.Background())
	defer stopCleanup()
	go func() {
		purge := func() {
			ctx, cancel := context.WithTimeout(cleanupCtx, 30*time.Second)
			defer cancel()
			if err := store.PurgeDeletedTopics(ctx); err != nil && cleanupCtx.Err() == nil {
				log.Error("board trash cleanup failed", "error", err)
			}
		}
		purge()
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-cleanupCtx.Done():
				return
			case <-ticker.C:
				purge()
			}
		}
	}()
	svc := &service.Service{Users: store, Sessions: store, Boards: store, Assets: store, Profiles: store, Tokens: auth.Tokens{Key: []byte(cfg.Secret), Issuer: cfg.Issuer, Audience: cfg.Audience, TTL: cfg.TTL}}
	handlers := &handler.Handler{Service: svc, Config: cfg, Ping: store.DB.PingContext, Log: log}
	server := &http.Server{Addr: cfg.Address, Handler: handlers.Routes(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 20 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 1 << 20}
	done := make(chan error, 1)
	go func() { log.Info("API listening", "address", cfg.Address); done <- server.ListenAndServe() }()
	signals := make(chan os.Signal, 1)
	signal.Notify(signals, os.Interrupt, syscall.SIGTERM)
	defer signal.Stop(signals)
	select {
	case err = <-done:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-signals:
	}
	shutdown, stop := context.WithTimeout(context.Background(), 10*time.Second)
	defer stop()
	return server.Shutdown(shutdown)
}

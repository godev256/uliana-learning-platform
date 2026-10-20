package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"time"
	"ulianaa.math/backend/internal/config"
	"ulianaa.math/backend/internal/model"
	"ulianaa.math/backend/internal/repository/postgres"
	"ulianaa.math/backend/internal/service"
	"ulianaa.math/backend/migrations"
)

func main() {
	file := flag.String("file", "", "Local snapshot path (required)")
	flag.Parse()
	if *file == "" {
		log.Fatal("usage: import-local -file SNAPSHOT.json")
	}
	input, err := os.Open(*file)
	if err != nil {
		log.Fatal(err)
	}
	defer input.Close()
	decoder := json.NewDecoder(io.LimitReader(input, 256<<20))
	var snapshot model.Snapshot
	if err = decoder.Decode(&snapshot); err != nil {
		log.Fatal(err)
	}
	if err = service.ValidateSnapshot(snapshot); err != nil {
		log.Fatal(err)
	}
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	store, err := postgres.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer store.DB.Close()
	if err = migrations.Apply(ctx, store.DB); err != nil {
		log.Fatal(err)
	}
	if err = store.ImportEmpty(ctx, snapshot); err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Imported: %d accounts, %d boards, %d asset chunks. Existing SQLite unchanged.\n", len(snapshot.Users), len(snapshot.Boards), len(snapshot.Assets))
}

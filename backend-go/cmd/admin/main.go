package main

import (
	"context"
	"fmt"
	"golang.org/x/term"
	"log"
	"os"
	"time"
	"ulianaa.math/backend/internal/config"
	"ulianaa.math/backend/internal/repository/postgres"
	"ulianaa.math/backend/internal/service"
	"ulianaa.math/backend/migrations"
)

func main() {
	if len(os.Args) != 3 || os.Args[1] != "create-teacher" {
		log.Fatal("usage: admin create-teacher LOGIN")
	}
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	fmt.Print("Password: ")
	password, err := term.ReadPassword(int(os.Stdin.Fd()))
	fmt.Println()
	if err != nil {
		log.Fatal(err)
	}
	fmt.Print("Repeat password: ")
	repeat, err := term.ReadPassword(int(os.Stdin.Fd()))
	fmt.Println()
	if err != nil || string(password) != string(repeat) {
		log.Fatal("passwords do not match")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	store, err := postgres.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer store.DB.Close()
	if err = migrations.Apply(ctx, store.DB); err != nil {
		log.Fatal(err)
	}
	svc := service.Service{Users: store}
	u, err := svc.Setup(ctx, os.Args[2], string(password))
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("Teacher created:", u.Login)
}

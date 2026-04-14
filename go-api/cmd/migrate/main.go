package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"strconv"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

func main() {
	dir := flag.String("dir", "migrations", "migrations directory")
	db := flag.String("db", "", "database URL (or set DATABASE_URL)")
	flag.Parse()

	dbURL := *db
	if dbURL == "" {
		dbURL = os.Getenv("DATABASE_URL")
	}
	if dbURL == "" {
		log.Fatal("database URL is required (-db flag or DATABASE_URL env)")
	}

	sourceURL := fmt.Sprintf("file://%s", *dir)
	m, err := migrate.New(sourceURL, dbURL)
	if err != nil {
		log.Fatalf("failed to create migrator: %v", err)
	}
	defer m.Close()

	args := flag.Args()
	if len(args) == 0 {
		log.Fatal("usage: migrate [up|down N|version|force V]")
	}

	switch args[0] {
	case "up":
		if err := m.Up(); err != nil && err != migrate.ErrNoChange {
			log.Fatalf("migration up failed: %v", err)
		}
		fmt.Println("migrations applied successfully")

	case "down":
		steps := 1
		if len(args) > 1 {
			steps, err = strconv.Atoi(args[1])
			if err != nil {
				log.Fatalf("invalid step count: %v", err)
			}
		}
		if err := m.Steps(-steps); err != nil && err != migrate.ErrNoChange {
			log.Fatalf("migration down failed: %v", err)
		}
		fmt.Printf("rolled back %d migration(s)\n", steps)

	case "version":
		v, dirty, err := m.Version()
		if err != nil {
			log.Fatalf("failed to get version: %v", err)
		}
		fmt.Printf("version: %d, dirty: %v\n", v, dirty)

	case "force":
		if len(args) < 2 {
			log.Fatal("usage: migrate force VERSION")
		}
		v, err := strconv.Atoi(args[1])
		if err != nil {
			log.Fatalf("invalid version: %v", err)
		}
		if err := m.Force(v); err != nil {
			log.Fatalf("force failed: %v", err)
		}
		fmt.Printf("forced version to %d\n", v)

	default:
		log.Fatalf("unknown command: %s", args[0])
	}
}

// Development-only native PostgreSQL. Docker Compose is the production path.
package main

import (
	"fmt"
	pg "github.com/fergusstrange/embedded-postgres"
	"log"
	"net/url"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"
)

func main() {
	u, err := url.Parse(os.Getenv("DATABASE_URL"))
	if err != nil || u.Hostname() != "127.0.0.1" || u.User == nil {
		log.Fatal("devdb requires a DATABASE_URL pointing to 127.0.0.1")
	}
	port, err := strconv.Atoi(u.Port())
	if err != nil {
		log.Fatal("invalid port")
	}
	password, _ := u.User.Password()
	if password == "" {
		log.Fatal("database password is required")
	}
	os.MkdirAll(".local", 0700)
	db := pg.NewDatabase(pg.DefaultConfig().Version(pg.V17).Port(uint32(port)).Username(u.User.Username()).Password(password).Database(u.Path[1:]).RuntimePath(".local/pg-runtime").DataPath(".local/pg-data").BinariesPath(".local/pg-bin").CachePath(".local/pg-cache").BinaryRepositoryURL("https://repo.maven.apache.org/maven2").StartParameters(map[string]string{"listen_addresses": "127.0.0.1"}).StartTimeout(60 * time.Second))
	if err = db.Start(); err != nil {
		log.Fatal(err)
	}
	fmt.Printf("PostgreSQL ready on 127.0.0.1:%d\n", port)
	signals := make(chan os.Signal, 1)
	signal.Notify(signals, os.Interrupt, syscall.SIGTERM)
	<-signals
	if err = db.Stop(); err != nil {
		log.Print(err)
	}
}

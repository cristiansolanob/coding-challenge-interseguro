// Command api boots the matrix rotation + QR factorization HTTP
// service: it loads configuration, wires the downstream Node API
// client, registers the Fiber routes, and shuts down gracefully on
// SIGINT/SIGTERM.
package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/joho/godotenv"

	"github.com/interseguro/matrix-qr-api/internal/client"
	"github.com/interseguro/matrix-qr-api/internal/config"
	apihttp "github.com/interseguro/matrix-qr-api/internal/http"
)

func main() {
	// Optional: load apps/go-api/.env into the process environment before
	// config.Load() reads it. Silently ignored when absent (e.g. in Docker,
	// where env vars are injected directly) — real env vars always take
	// precedence over .env, since godotenv.Load() never overwrites a var
	// that is already set.
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	downstream := client.New(cfg.NodeAPIURL, cfg.NodeAPIPath, cfg.NodeAPITimeout)
	handler := apihttp.NewHandler(downstream)

	app := fiber.New(fiber.Config{
		ErrorHandler: apihttp.Handle,
	})
	app.Use(recover.New())
	app.Use(requestid.New())
	// CORS: this API has no authentication (out of scope, see README), so
	// there are no credentials/cookies to protect; allowing any origin lets
	// the browser-based frontend (apps/web) call it from any host/port
	// without a separate allowlist to maintain.
	app.Use(cors.New())

	app.Get("/health", apihttp.Health)
	app.Post("/api/v1/matrix/qr", handler.MatrixQR)

	go func() {
		addr := ":" + cfg.Port
		log.Printf("listening on %s", addr)
		if err := app.Listen(addr); err != nil {
			log.Fatalf("server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("shutting down gracefully")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := app.ShutdownWithContext(ctx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
}

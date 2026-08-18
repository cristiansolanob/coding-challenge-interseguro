package http

import "github.com/gofiber/fiber/v2"

// Health implements GET /health. It always returns 200 with a status
// body and never depends on downstream availability.
func Health(c *fiber.Ctx) error {
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"status": "ok"})
}

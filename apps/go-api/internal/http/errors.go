package http

import (
	"errors"

	"github.com/gofiber/fiber/v2"
	"github.com/interseguro/matrix-qr-api/internal/apierr"
)

// Handle is the Fiber-wide error handler. It maps any *apierr.Error to
// its documented HTTP status/code/message/details envelope. Any other
// error (including panics recovered by the Fiber recover middleware) is
// treated as an unexpected failure and mapped to 500 INTERNAL, so the
// error taxonomy never drifts between packages.
func Handle(c *fiber.Ctx, err error) error {
	var apiErr *apierr.Error
	if errors.As(err, &apiErr) {
		return respondError(c, apiErr)
	}

	internal := apierr.Internal(err.Error())
	return respondError(c, internal)
}

func respondError(c *fiber.Ctx, apiErr *apierr.Error) error {
	return c.Status(apiErr.HTTPStatus).JSON(ErrorResponse{
		Error: ErrorDetail{
			Code:    apiErr.Code,
			Message: apiErr.Message,
			Details: apiErr.Details,
		},
	})
}

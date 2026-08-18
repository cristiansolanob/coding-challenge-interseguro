package http

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"math"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	fiberrecover "github.com/gofiber/fiber/v2/middleware/recover"
)

const epsilon = 1e-9

// fakeDownstreamClient is a spy/fake DownstreamClient used by handler
// tests so no live Node API is required.
type fakeDownstreamClient struct {
	called   bool
	response json.RawMessage
	err      error
	panicOn  bool
}

func (f *fakeDownstreamClient) Send(ctx context.Context, p DownstreamPayload) (json.RawMessage, error) {
	f.called = true
	if f.panicOn {
		panic("simulated downstream panic")
	}
	if f.err != nil {
		return nil, f.err
	}
	return f.response, nil
}

func newTestApp(downstream DownstreamClient) *fiber.App {
	app := fiber.New(fiber.Config{ErrorHandler: Handle})
	app.Use(fiberrecover.New())
	h := NewHandler(downstream)
	app.Post("/api/v1/matrix/qr", h.MatrixQR)
	return app
}

func doRequest(t *testing.T, app *fiber.App, body string) (*httptest.ResponseRecorder, map[string]any) {
	t.Helper()
	req := httptest.NewRequest("POST", "/api/v1/matrix/qr", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test() error: %v", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read response body: %v", err)
	}

	var parsed map[string]any
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &parsed); err != nil {
			t.Fatalf("unmarshal response body: %v (raw: %s)", err, raw)
		}
	}

	rec := httptest.NewRecorder()
	rec.Code = resp.StatusCode
	return rec, parsed
}

func errorCode(t *testing.T, parsed map[string]any) string {
	t.Helper()
	errObj, ok := parsed["error"].(map[string]any)
	if !ok {
		t.Fatalf("response has no error object: %v", parsed)
	}
	code, _ := errObj["code"].(string)
	return code
}

// Scenario: Missing matrix field
func TestMatrixQR_MissingMatrixField(t *testing.T) {
	fake := &fakeDownstreamClient{}
	app := newTestApp(fake)

	rec, parsed := doRequest(t, app, `{}`)
	if rec.Code != fiber.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
	if code := errorCode(t, parsed); code != "MATRIX_REQUIRED" {
		t.Errorf("code = %q, want MATRIX_REQUIRED", code)
	}
}

// Scenario: Empty matrix
func TestMatrixQR_EmptyMatrix(t *testing.T) {
	fake := &fakeDownstreamClient{}
	app := newTestApp(fake)

	rec, parsed := doRequest(t, app, `{"matrix": []}`)
	if rec.Code != fiber.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
	if code := errorCode(t, parsed); code != "MATRIX_EMPTY" {
		t.Errorf("code = %q, want MATRIX_EMPTY", code)
	}
}

// Scenario: Ragged rows — also asserts the downstream client is never invoked.
func TestMatrixQR_RaggedRows_ShortCircuitsBeforeDownstream(t *testing.T) {
	fake := &fakeDownstreamClient{}
	app := newTestApp(fake)

	rec, parsed := doRequest(t, app, `{"matrix": [[1,2],[3]]}`)
	if rec.Code != fiber.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
	if code := errorCode(t, parsed); code != "MATRIX_RAGGED" {
		t.Errorf("code = %q, want MATRIX_RAGGED", code)
	}

	errObj := parsed["error"].(map[string]any)
	details, ok := errObj["details"].(map[string]any)
	if !ok {
		t.Fatalf("expected error.details, got %v", errObj)
	}
	if details["row"].(float64) != 2 || details["expected"].(float64) != 2 || details["got"].(float64) != 1 {
		t.Errorf("details = %v, want row=2 expected=2 got=1", details)
	}

	if fake.called {
		t.Error("downstream client was called despite ragged-input validation failure")
	}
}

// Scenario: Non-numeric element
func TestMatrixQR_NonNumericElement(t *testing.T) {
	fake := &fakeDownstreamClient{}
	app := newTestApp(fake)

	rec, parsed := doRequest(t, app, `{"matrix": [["a",2],[3,4]]}`)
	if rec.Code != fiber.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
	if code := errorCode(t, parsed); code != "MATRIX_NOT_NUMERIC" {
		t.Errorf("code = %q, want MATRIX_NOT_NUMERIC", code)
	}
}

// Scenario: Matrix exceeds 100x100 / 10,000-element limit (101 rows x 5 cols)
func TestMatrixQR_TooLarge_Rejected(t *testing.T) {
	fake := &fakeDownstreamClient{}
	app := newTestApp(fake)

	rows := make([][]float64, 101)
	for i := range rows {
		rows[i] = []float64{1, 2, 3, 4, 5}
	}
	body, _ := json.Marshal(map[string]any{"matrix": rows})

	rec, parsed := doRequest(t, app, string(body))
	if rec.Code != fiber.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
	if code := errorCode(t, parsed); code != "MATRIX_TOO_LARGE" {
		t.Errorf("code = %q, want MATRIX_TOO_LARGE", code)
	}
}

// Scenario: Matrix at the exact limit is accepted (100x100 -> proceeds past validation)
func TestMatrixQR_AtLimit_PassesValidation(t *testing.T) {
	fake := &fakeDownstreamClient{response: json.RawMessage(`{"status":"ok"}`)}
	app := newTestApp(fake)

	rows := make([][]float64, 100)
	for i := range rows {
		row := make([]float64, 100)
		for j := range row {
			row[j] = float64(i + j)
		}
		rows[i] = row
	}
	body, _ := json.Marshal(map[string]any{"matrix": rows})

	rec, parsed := doRequest(t, app, string(body))
	// A 100x100 square input rotates to a 100x100 square (QR-eligible), so
	// this must NOT fail with MATRIX_TOO_LARGE; it should reach 200.
	if rec.Code == fiber.StatusBadRequest {
		if code := errorCode(t, parsed); code == "MATRIX_TOO_LARGE" {
			t.Fatalf("100x100 matrix incorrectly rejected as MATRIX_TOO_LARGE")
		}
	}
	if rec.Code != fiber.StatusOK {
		t.Errorf("status = %d, want 200 (parsed: %v)", rec.Code, parsed)
	}
}

// Scenario: Rotation produces an ineligible shape -> 422 QR_SHAPE_UNSUPPORTED
func TestMatrixQR_RotatedShapeIneligible(t *testing.T) {
	fake := &fakeDownstreamClient{}
	app := newTestApp(fake)

	// 3x2 input rotates to 2x3 (rows < cols) -> ineligible.
	rec, parsed := doRequest(t, app, `{"matrix": [[1,2],[3,4],[5,6]]}`)
	if rec.Code != fiber.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", rec.Code)
	}
	if code := errorCode(t, parsed); code != "QR_SHAPE_UNSUPPORTED" {
		t.Errorf("code = %q, want QR_SHAPE_UNSUPPORTED", code)
	}
}

// Scenario: Valid tall matrix returns full contract
func TestMatrixQR_HappyPath(t *testing.T) {
	fake := &fakeDownstreamClient{response: json.RawMessage(`{"mean":3.5,"stddev":1.2}`)}
	app := newTestApp(fake)

	// 2x3 input rotates to 3x2 (rows >= cols) -> QR-eligible.
	rec, parsed := doRequest(t, app, `{"matrix": [[1,2,3],[4,5,6]]}`)
	if rec.Code != fiber.StatusOK {
		t.Fatalf("status = %d, want 200 (parsed: %v)", rec.Code, parsed)
	}

	input := parsed["input"].(map[string]any)
	if input["rows"].(float64) != 2 || input["cols"].(float64) != 3 {
		t.Errorf("input dims = %v, want rows=2 cols=3", input)
	}

	rotated := parsed["rotated"].(map[string]any)
	if rotated["rows"].(float64) != 3 || rotated["cols"].(float64) != 2 {
		t.Errorf("rotated dims = %v, want rows=3 cols=2", rotated)
	}
	wantRotated := [][]float64{{4, 1}, {5, 2}, {6, 3}}
	gotRotated := rotated["values"].([]any)
	for i, row := range gotRotated {
		r := row.([]any)
		for j, v := range r {
			got := v.(float64)
			want := wantRotated[i][j]
			if math.Abs(got-want) > epsilon {
				t.Errorf("rotated.values[%d][%d] = %v, want %v", i, j, got, want)
			}
		}
	}

	q := parsed["q"].(map[string]any)
	if q["rows"].(float64) != 3 || q["cols"].(float64) != 3 {
		t.Errorf("q dims = %v, want rows=3 cols=3", q)
	}
	r := parsed["r"].(map[string]any)
	if r["rows"].(float64) != 3 || r["cols"].(float64) != 2 {
		t.Errorf("r dims = %v, want rows=3 cols=2", r)
	}

	downstream := parsed["downstream"].(map[string]any)
	if downstream["status"].(string) != "ok" {
		t.Errorf("downstream.status = %v, want ok", downstream["status"])
	}
	downstreamBody := downstream["body"].(map[string]any)
	if downstreamBody["mean"].(float64) != 3.5 || downstreamBody["stddev"].(float64) != 1.2 {
		t.Errorf("downstream.body = %v, want verbatim echo", downstreamBody)
	}

	if !fake.called {
		t.Error("downstream client was not called on the happy path")
	}
}

// Scenario: Downstream unreachable
func TestMatrixQR_DownstreamError(t *testing.T) {
	fake := &fakeDownstreamClient{err: context.DeadlineExceeded}
	app := newTestApp(fake)

	rec, parsed := doRequest(t, app, `{"matrix": [[1,2,3],[4,5,6]]}`)
	if rec.Code != fiber.StatusBadGateway {
		t.Errorf("status = %d, want 502", rec.Code)
	}
	if code := errorCode(t, parsed); code != "DOWNSTREAM_UNAVAILABLE" {
		t.Errorf("code = %q, want DOWNSTREAM_UNAVAILABLE", code)
	}

	for _, forbidden := range []string{"q", "r", "rotated", "input"} {
		if _, present := parsed[forbidden]; present {
			t.Errorf("response body must not contain %q on downstream failure, got %v", forbidden, parsed)
		}
	}
}

// Scenario: Unexpected panic is recovered
func TestMatrixQR_PanicIsRecovered(t *testing.T) {
	fake := &fakeDownstreamClient{panicOn: true}
	app := newTestApp(fake)

	rec, parsed := doRequest(t, app, `{"matrix": [[1,2,3],[4,5,6]]}`)
	if rec.Code != fiber.StatusInternalServerError {
		t.Errorf("status = %d, want 500", rec.Code)
	}
	if code := errorCode(t, parsed); code != "INTERNAL" {
		t.Errorf("code = %q, want INTERNAL", code)
	}

	// Server must stay usable after a recovered panic.
	rec2, _ := doRequest(t, app, `{}`)
	if rec2.Code != fiber.StatusBadRequest {
		t.Errorf("server did not stay usable after recovered panic: status = %d", rec2.Code)
	}
}

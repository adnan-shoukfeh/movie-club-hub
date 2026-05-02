# Feedback Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Send feedback" card at the bottom of the personal Settings page that lets a signed-in user submit a free-form text message plus one optional image. The submission is written into the existing GCS bucket under `requests/<id>/`.

**Architecture:** A single `POST /me/feedback` endpoint accepts `multipart/form-data` (text + optional image), the Go handler validates and sanitizes inputs, then writes 2-3 objects (`request.txt`, `meta.json`, optionally `image.<ext>`) into the bucket. The route is rate-limited (3/hour per user). Frontend opens a Radix Dialog from the settings page and posts the FormData directly via `fetch` (multipart isn't worth threading through the OpenAPI client).

**Tech Stack:** Go 1.25 (chi, `cloud.google.com/go/storage`), React/Vite/TypeScript, Tailwind, Radix UI dialog, TanStack Query, OpenAPI 3.1 (orval).

**Reference spec:** `docs/superpowers/specs/2026-05-02-feedback-feature.md`

---

## File map

**Created:**
- `go-api/internal/handler/feedback.go` — `SubmitFeedback` handler, `feedbackStorage` interface, magic-byte detection, request-ID generation
- `go-api/internal/handler/feedback_test.go` — table-driven tests with stub storage
- `go-api/internal/handler/sanitize_test.go` — tests for the new `sanitizeFeedback` helper
- `artifacts/movie-club/src/domains/auth/components/FeedbackForm.tsx` — modal component

**Modified:**
- `go-api/internal/handler/sanitize.go` — add `sanitizeFeedback` helper
- `go-api/cmd/server/main.go` — wire route + per-user rate limiter
- `lib/api-spec/openapi.yaml` — add path entry (documentation only; multipart submit is hand-rolled in the component)
- `artifacts/movie-club/src/pages/settings.tsx` — render `<FeedbackForm />` at the bottom

---

## Task 1: Add `sanitizeFeedback` helper (TDD)

**Files:**
- Modify: `go-api/internal/handler/sanitize.go`
- Create: `go-api/internal/handler/sanitize_test.go`

The helper is a thin wrapper around `sanitizeText` with the feedback-specific 5,000-char cap. Adding it as a named function keeps the handler readable and makes the test target obvious.

- [ ] **Step 1: Write the failing test**

Create `go-api/internal/handler/sanitize_test.go`:

```go
package handler

import (
	"strings"
	"testing"
)

func TestSanitizeFeedback(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{"trims whitespace", "  hello  ", "hello"},
		{"strips control chars except whitespace", "ab\x00c\x07d\nE", "abcd\nE"},
		{"keeps newlines and tabs", "line1\nline2\tindented", "line1\nline2\tindented"},
		{"empty string passes through", "", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := sanitizeFeedback(tt.in)
			if got != tt.want {
				t.Errorf("got %q, want %q", got, tt.want)
			}
		})
	}
}

func TestSanitizeFeedback_TruncatesAt5000(t *testing.T) {
	in := strings.Repeat("a", 6000)
	got := sanitizeFeedback(in)
	if len(got) != 5000 {
		t.Errorf("got len %d, want 5000", len(got))
	}
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd go-api && go test ./internal/handler -run TestSanitizeFeedback`
Expected: FAIL with `undefined: sanitizeFeedback`.

- [ ] **Step 3: Add the helper**

Append to `go-api/internal/handler/sanitize.go` (after `sanitizeReview`):

```go
const feedbackMaxLen = 5000

func sanitizeFeedback(raw string) string {
	return sanitizeText(raw, feedbackMaxLen)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd go-api && go test ./internal/handler -run TestSanitizeFeedback -v`
Expected: PASS for all five cases.

- [ ] **Step 5: Commit**

```bash
git add go-api/internal/handler/sanitize.go go-api/internal/handler/sanitize_test.go
git commit -m "feat(handler): add sanitizeFeedback helper"
```

---

## Task 2: Add `feedbackStorage` interface and request-ID generator (TDD)

**Files:**
- Create: `go-api/internal/handler/feedback.go`
- Create: `go-api/internal/handler/feedback_test.go`

The interface is a small surface so tests can run without GCS. The existing `*service.GCSService` satisfies it for free. The request ID is a UTC timestamp + 6-hex random suffix.

- [ ] **Step 1: Write the failing test**

Create `go-api/internal/handler/feedback_test.go`:

```go
package handler

import (
	"regexp"
	"testing"
	"time"
)

func TestNewRequestID_FormatAndUniqueness(t *testing.T) {
	pattern := regexp.MustCompile(`^\d{8}-\d{6}-[0-9a-f]{6}$`)

	id1 := newRequestID(time.Date(2026, 5, 2, 14, 30, 22, 0, time.UTC))
	if !pattern.MatchString(id1) {
		t.Errorf("id1 %q does not match %s", id1, pattern)
	}
	if got := id1[:15]; got != "20260502-143022" {
		t.Errorf("timestamp prefix: got %q, want %q", got, "20260502-143022")
	}

	// Two IDs at the same timestamp differ in the suffix.
	id2 := newRequestID(time.Date(2026, 5, 2, 14, 30, 22, 0, time.UTC))
	if id1 == id2 {
		t.Errorf("expected distinct suffixes, got %q twice", id1)
	}
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd go-api && go test ./internal/handler -run TestNewRequestID`
Expected: FAIL with `undefined: newRequestID`.

- [ ] **Step 3: Create the file with the interface and generator**

Create `go-api/internal/handler/feedback.go`:

```go
package handler

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"time"
)

// feedbackStorage is the narrow GCS surface SubmitFeedback needs.
// *service.GCSService satisfies this interface.
type feedbackStorage interface {
	IsConfigured() bool
	UploadFromReader(ctx context.Context, objectName, contentType string, r io.Reader) (string, error)
}

// newRequestID returns a folder-safe ID of the form YYYYMMDD-HHMMSS-<6hex>.
// The 6-hex suffix prevents collisions when two users submit in the same second.
func newRequestID(now time.Time) string {
	var b [3]byte
	if _, err := rand.Read(b[:]); err != nil {
		// crypto/rand failure is essentially impossible; fall back to nanos.
		nanos := now.UnixNano()
		return fmt.Sprintf("%s-%06x", now.UTC().Format("20060102-150405"), nanos&0xFFFFFF)
	}
	return fmt.Sprintf("%s-%s", now.UTC().Format("20060102-150405"), hex.EncodeToString(b[:]))
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd go-api && go test ./internal/handler -run TestNewRequestID -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add go-api/internal/handler/feedback.go go-api/internal/handler/feedback_test.go
git commit -m "feat(handler): add feedback storage interface and request ID generator"
```

---

## Task 3: Add image content-type detection (TDD)

**Files:**
- Modify: `go-api/internal/handler/feedback.go`
- Modify: `go-api/internal/handler/feedback_test.go`

We accept PNG, JPEG, WebP, GIF, HEIC, HEIF. Go's `http.DetectContentType` handles the first four; HEIC/HEIF need a magic-byte check on the ISO Base Media File Format brand at offset 4.

- [ ] **Step 1: Write the failing test**

Append to `feedback_test.go`:

```go
func TestDetectImageType(t *testing.T) {
	tests := []struct {
		name      string
		head      []byte
		wantType  string
		wantExt   string
		wantOK    bool
	}{
		{
			name:     "PNG signature",
			head:     []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A},
			wantType: "image/png",
			wantExt:  ".png",
			wantOK:   true,
		},
		{
			name:     "JPEG signature",
			head:     []byte{0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 'J', 'F', 'I', 'F'},
			wantType: "image/jpeg",
			wantExt:  ".jpg",
			wantOK:   true,
		},
		{
			name:     "GIF signature",
			head:     []byte("GIF89a\x01\x00\x01\x00\x00"),
			wantType: "image/gif",
			wantExt:  ".gif",
			wantOK:   true,
		},
		{
			name:     "WEBP signature",
			head:     append([]byte("RIFF"), append([]byte{0x00, 0x00, 0x00, 0x00}, []byte("WEBPVP8 ")...)...),
			wantType: "image/webp",
			wantExt:  ".webp",
			wantOK:   true,
		},
		{
			name:     "HEIC brand heic",
			head:     append([]byte{0x00, 0x00, 0x00, 0x20}, []byte("ftypheic")...),
			wantType: "image/heic",
			wantExt:  ".heic",
			wantOK:   true,
		},
		{
			name:     "HEIF brand mif1",
			head:     append([]byte{0x00, 0x00, 0x00, 0x20}, []byte("ftypmif1")...),
			wantType: "image/heif",
			wantExt:  ".heif",
			wantOK:   true,
		},
		{
			name:   "HTML disguised as image",
			head:   []byte("<!DOCTYPE html><html>"),
			wantOK: false,
		},
		{
			name:   "PDF",
			head:   []byte("%PDF-1.7"),
			wantOK: false,
		},
		{
			name:   "empty",
			head:   []byte{},
			wantOK: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotType, gotExt, gotOK := detectImageType(tt.head)
			if gotOK != tt.wantOK {
				t.Errorf("ok: got %v, want %v (type=%q)", gotOK, tt.wantOK, gotType)
			}
			if !tt.wantOK {
				return
			}
			if gotType != tt.wantType {
				t.Errorf("type: got %q, want %q", gotType, tt.wantType)
			}
			if gotExt != tt.wantExt {
				t.Errorf("ext: got %q, want %q", gotExt, tt.wantExt)
			}
		})
	}
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd go-api && go test ./internal/handler -run TestDetectImageType`
Expected: FAIL with `undefined: detectImageType`.

- [ ] **Step 3: Add the detector**

Add to `go-api/internal/handler/feedback.go` (after the imports — extend the import block):

```go
import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"time"
)
```

Then add:

```go
// detectImageType inspects the first bytes of a file and returns its MIME type
// and canonical extension if it is one of the allowed image formats. HEIC/HEIF
// detection is hand-rolled because Go's stdlib does not sniff them.
func detectImageType(head []byte) (mimeType, ext string, ok bool) {
	// HEIC/HEIF: ISO Base Media File Format brand at offset 4 ("ftyp" + brand).
	if len(head) >= 12 && bytes.Equal(head[4:8], []byte("ftyp")) {
		brand := string(head[8:12])
		switch brand {
		case "heic", "heix", "heis", "hevc", "hevx", "heim":
			return "image/heic", ".heic", true
		case "mif1", "msf1", "heif":
			return "image/heif", ".heif", true
		}
	}

	switch http.DetectContentType(head) {
	case "image/png":
		return "image/png", ".png", true
	case "image/jpeg":
		return "image/jpeg", ".jpg", true
	case "image/gif":
		return "image/gif", ".gif", true
	case "image/webp":
		return "image/webp", ".webp", true
	}
	return "", "", false
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd go-api && go test ./internal/handler -run TestDetectImageType -v`
Expected: PASS for all nine cases.

- [ ] **Step 5: Commit**

```bash
git add go-api/internal/handler/feedback.go go-api/internal/handler/feedback_test.go
git commit -m "feat(handler): add image type detection for feedback uploads"
```

---

## Task 4: Implement `SubmitFeedback` handler — text-only path (TDD)

**Files:**
- Modify: `go-api/internal/handler/feedback.go`
- Modify: `go-api/internal/handler/feedback_test.go`

This task implements the entire handler, but the tests in this task only cover the text-only paths (no image, missing text, short text, GCS not configured). Image paths are covered in Task 5 with no further handler changes — the handler is complete after this task.

- [ ] **Step 1: Write the failing tests**

Append to `feedback_test.go`:

```go
import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/db"
	"github.com/adnanshoukfeh/movie-club-hub/go-api/internal/session"
)
```

(Merge with the existing import block.)

```go
// stubStorage records uploads instead of hitting GCS.
type stubStorage struct {
	configured bool
	uploads    []stubUpload
	failOn     string // object name to fail on, "" disables
}

type stubUpload struct {
	objectName  string
	contentType string
	body        []byte
}

func (s *stubStorage) IsConfigured() bool { return s.configured }

func (s *stubStorage) UploadFromReader(_ context.Context, name, ct string, r io.Reader) (string, error) {
	if s.failOn != "" && s.failOn == name {
		return "", errors.New("forced failure")
	}
	body, err := io.ReadAll(r)
	if err != nil {
		return "", err
	}
	s.uploads = append(s.uploads, stubUpload{objectName: name, contentType: ct, body: body})
	return "https://example/" + name, nil
}

// buildMultipart builds a multipart body with optional text and image parts.
func buildMultipart(t *testing.T, text string, image []byte, imageFilename string) (body *bytes.Buffer, contentType string) {
	t.Helper()
	body = &bytes.Buffer{}
	w := multipart.NewWriter(body)
	if text != "" {
		if err := w.WriteField("text", text); err != nil {
			t.Fatalf("write text: %v", err)
		}
	}
	if image != nil {
		fw, err := w.CreateFormFile("image", imageFilename)
		if err != nil {
			t.Fatalf("create form file: %v", err)
		}
		if _, err := fw.Write(image); err != nil {
			t.Fatalf("write image: %v", err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatalf("close writer: %v", err)
	}
	return body, w.FormDataContentType()
}

// newTestHandler builds a Handler wired with a stub storage and a session
// manager that always returns a fixed userID via a request that has the
// userID stashed in context. We bypass the session manager by setting
// h.testUserID and reading it in userID(); see Task 4 Step 3 below.
//
// For unit tests we don't construct a real *db.Queries — the handler does
// h.q.GetUserByID for the username; we sidestep that by allowing the username
// lookup to fail (handler logs a warning and writes meta.json with empty
// username). Confirm this fallback is implemented in Step 3.
func newTestHandler(stub *stubStorage) *Handler {
	return &Handler{
		feedbackStorage: stub,
		// q and sm intentionally nil — text-path tests do not exercise them
		// once the username-lookup fallback is in place.
	}
}

func decodeJSON(t *testing.T, body io.Reader, v any) {
	t.Helper()
	if err := json.NewDecoder(body).Decode(v); err != nil {
		t.Fatalf("decode json: %v", err)
	}
}

const testUserID int32 = 42

func TestSubmitFeedback_GCSNotConfigured(t *testing.T) {
	stub := &stubStorage{configured: false}
	h := newTestHandler(stub)

	body, ct := buildMultipart(t, "this is at least ten chars long", nil, "")
	req := httptest.NewRequest(http.MethodPost, "/api/me/feedback", body)
	req.Header.Set("Content-Type", ct)
	req = injectUserID(req, testUserID)

	w := httptest.NewRecorder()
	h.SubmitFeedback(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("status: got %d, want %d", w.Code, http.StatusServiceUnavailable)
	}
	if len(stub.uploads) != 0 {
		t.Errorf("expected no uploads, got %d", len(stub.uploads))
	}
}

func TestSubmitFeedback_TextTooShort(t *testing.T) {
	stub := &stubStorage{configured: true}
	h := newTestHandler(stub)

	body, ct := buildMultipart(t, "short", nil, "")
	req := httptest.NewRequest(http.MethodPost, "/api/me/feedback", body)
	req.Header.Set("Content-Type", ct)
	req = injectUserID(req, testUserID)

	w := httptest.NewRecorder()
	h.SubmitFeedback(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status: got %d, want %d", w.Code, http.StatusBadRequest)
	}
	if len(stub.uploads) != 0 {
		t.Errorf("expected no uploads, got %d", len(stub.uploads))
	}
}

func TestSubmitFeedback_MissingText(t *testing.T) {
	stub := &stubStorage{configured: true}
	h := newTestHandler(stub)

	body, ct := buildMultipart(t, "", nil, "")
	req := httptest.NewRequest(http.MethodPost, "/api/me/feedback", body)
	req.Header.Set("Content-Type", ct)
	req = injectUserID(req, testUserID)

	w := httptest.NewRecorder()
	h.SubmitFeedback(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status: got %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestSubmitFeedback_TextOnlyHappyPath(t *testing.T) {
	stub := &stubStorage{configured: true}
	h := newTestHandler(stub)

	body, ct := buildMultipart(t, "I found a bug in the dashboard.", nil, "")
	req := httptest.NewRequest(http.MethodPost, "/api/me/feedback", body)
	req.Header.Set("Content-Type", ct)
	req.Header.Set("User-Agent", "TestAgent/1.0")
	req = injectUserID(req, testUserID)

	w := httptest.NewRecorder()
	h.SubmitFeedback(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status: got %d, want %d (body=%s)", w.Code, http.StatusOK, w.Body.String())
	}

	var resp struct {
		RequestID string `json:"requestId"`
	}
	decodeJSON(t, w.Body, &resp)
	if resp.RequestID == "" {
		t.Fatal("expected non-empty requestId")
	}

	// Expect exactly two uploads: request.txt and meta.json.
	if len(stub.uploads) != 2 {
		t.Fatalf("expected 2 uploads, got %d", len(stub.uploads))
	}
	wantPrefix := "requests/" + resp.RequestID + "/"
	if !strings.HasPrefix(stub.uploads[0].objectName, wantPrefix) {
		t.Errorf("upload[0] name %q missing prefix %q", stub.uploads[0].objectName, wantPrefix)
	}
	if stub.uploads[0].objectName != wantPrefix+"request.txt" {
		t.Errorf("upload[0]: got %q, want %q", stub.uploads[0].objectName, wantPrefix+"request.txt")
	}
	if string(stub.uploads[0].body) != "I found a bug in the dashboard." {
		t.Errorf("text body: got %q", string(stub.uploads[0].body))
	}
	if stub.uploads[1].objectName != wantPrefix+"meta.json" {
		t.Errorf("upload[1]: got %q, want %q", stub.uploads[1].objectName, wantPrefix+"meta.json")
	}
	var meta map[string]any
	if err := json.Unmarshal(stub.uploads[1].body, &meta); err != nil {
		t.Fatalf("meta.json unmarshal: %v", err)
	}
	if meta["userId"].(float64) != float64(testUserID) {
		t.Errorf("meta.userId: got %v, want %d", meta["userId"], testUserID)
	}
	if meta["userAgent"] != "TestAgent/1.0" {
		t.Errorf("meta.userAgent: got %v", meta["userAgent"])
	}
	if meta["hasImage"] != false {
		t.Errorf("meta.hasImage: got %v, want false", meta["hasImage"])
	}
}
```

The `injectUserID` helper and the `feedbackStorage` field need to be added in Step 3. Suppress unused-import errors by including only what each test uses.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd go-api && go test ./internal/handler -run TestSubmitFeedback`
Expected: compile errors (`Handler has no field feedbackStorage`, `undefined: injectUserID`, `undefined: SubmitFeedback`).

- [ ] **Step 3: Add the field, the user-ID injector, and the handler**

In `go-api/internal/handler/handler.go`, modify the `Handler` struct to add the storage field and a test-only user-ID:

```go
type Handler struct {
	q         *db.Queries
	pool      *pgxpool.Pool
	sm        *session.Manager
	omdbCache *omdbCache

	authSvc        *service.AuthService
	groupSvc       *service.GroupService
	turnSvc        *service.TurnService
	verdictSvc     *service.VerdictService
	movieSvc       *service.MovieService
	nominationSvc  *service.NominationService
	gcsSvc         *service.GCSService
	profileSvc     *service.ProfileService

	// feedbackStorage isolates the feedback handler from *service.GCSService
	// for testing. Defaults to gcsSvc; tests inject a stub.
	feedbackStorage feedbackStorage
}
```

Update `New()` to set the default:

```go
func New(q *db.Queries, pool *pgxpool.Pool, sm *session.Manager, cfg service.Config, gcsSvc *service.GCSService) *Handler {
	h := &Handler{
		q:              q,
		pool:           pool,
		sm:             sm,
		omdbCache:      newOMDBCache(),
		authSvc:        service.NewAuthService(q, cfg),
		groupSvc:       service.NewGroupService(q, cfg),
		turnSvc:        service.NewTurnService(q, cfg),
		verdictSvc:     service.NewVerdictService(q, pool, cfg),
		movieSvc:       service.NewMovieService(q, cfg),
		nominationSvc:  service.NewNominationService(q, cfg),
		gcsSvc:         gcsSvc,
		profileSvc:     service.NewProfileService(q),
	}
	h.feedbackStorage = gcsSvc
	return h
}
```

In `go-api/internal/handler/feedback.go`, add the handler. The full file should now read:

```go
package handler

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"
)

const (
	feedbackTextMinLen   = 10
	feedbackImageMaxSize = 10 * 1024 * 1024 // 10 MB
	feedbackBodyMaxSize  = 11 * 1024 * 1024 // 11 MB cap for the multipart body
)

// feedbackStorage is the narrow GCS surface SubmitFeedback needs.
// *service.GCSService satisfies this interface.
type feedbackStorage interface {
	IsConfigured() bool
	UploadFromReader(ctx context.Context, objectName, contentType string, r io.Reader) (string, error)
}

// newRequestID returns a folder-safe ID of the form YYYYMMDD-HHMMSS-<6hex>.
// The 6-hex suffix prevents collisions when two users submit in the same second.
func newRequestID(now time.Time) string {
	var b [3]byte
	if _, err := rand.Read(b[:]); err != nil {
		nanos := now.UnixNano()
		return fmt.Sprintf("%s-%06x", now.UTC().Format("20060102-150405"), nanos&0xFFFFFF)
	}
	return fmt.Sprintf("%s-%s", now.UTC().Format("20060102-150405"), hex.EncodeToString(b[:]))
}

// detectImageType inspects the first bytes of a file and returns its MIME type
// and canonical extension if it is one of the allowed image formats.
func detectImageType(head []byte) (mimeType, ext string, ok bool) {
	if len(head) >= 12 && bytes.Equal(head[4:8], []byte("ftyp")) {
		brand := string(head[8:12])
		switch brand {
		case "heic", "heix", "heis", "hevc", "hevx", "heim":
			return "image/heic", ".heic", true
		case "mif1", "msf1", "heif":
			return "image/heif", ".heif", true
		}
	}
	switch http.DetectContentType(head) {
	case "image/png":
		return "image/png", ".png", true
	case "image/jpeg":
		return "image/jpeg", ".jpg", true
	case "image/gif":
		return "image/gif", ".gif", true
	case "image/webp":
		return "image/webp", ".webp", true
	}
	return "", "", false
}

func (h *Handler) SubmitFeedback(w http.ResponseWriter, r *http.Request) {
	if h.feedbackStorage == nil || !h.feedbackStorage.IsConfigured() {
		writeError(w, http.StatusServiceUnavailable, "Feedback uploads are not configured")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, feedbackBodyMaxSize)
	if err := r.ParseMultipartForm(feedbackBodyMaxSize); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid or oversized request")
		return
	}

	rawText := r.FormValue("text")
	text := sanitizeFeedback(rawText)
	if len(text) < feedbackTextMinLen {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Feedback must be at least %d characters", feedbackTextMinLen))
		return
	}

	// Image is optional.
	var (
		imageBytes  []byte
		imageMime   string
		imageExt    string
		hasImage    bool
	)
	if file, header, err := r.FormFile("image"); err == nil {
		defer file.Close()
		if header.Size > feedbackImageMaxSize {
			writeError(w, http.StatusBadRequest, "Image must be 10 MB or smaller")
			return
		}
		buf, err := io.ReadAll(file)
		if err != nil {
			writeError(w, http.StatusBadRequest, "Could not read uploaded image")
			return
		}
		head := buf
		if len(head) > 512 {
			head = head[:512]
		}
		mt, ext, ok := detectImageType(head)
		if !ok {
			writeError(w, http.StatusBadRequest, "Unsupported image type. Allowed: PNG, JPEG, WebP, GIF, HEIC, HEIF")
			return
		}
		imageBytes = buf
		imageMime = mt
		imageExt = ext
		hasImage = true
	} else if !errors.Is(err, http.ErrMissingFile) {
		// A real error reading the file; ErrMissingFile just means no image was sent.
		writeError(w, http.StatusBadRequest, "Could not read uploaded image")
		return
	}

	now := time.Now()
	id := newRequestID(now)
	prefix := "requests/" + id + "/"

	ctx := r.Context()

	// 1. text
	if _, err := h.feedbackStorage.UploadFromReader(ctx, prefix+"request.txt", "text/plain; charset=utf-8", bytes.NewReader([]byte(text))); err != nil {
		slog.Error("feedback: failed to upload request.txt", "error", err, "id", id)
		writeError(w, http.StatusInternalServerError, "Failed to save feedback")
		return
	}

	// 2. meta.json
	username := h.lookupUsername(ctx, r)
	userAgent := sanitizeText(r.UserAgent(), 500)
	meta := map[string]any{
		"userId":      h.userIDForFeedback(r),
		"username":    username,
		"submittedAt": now.UTC().Format(time.RFC3339),
		"userAgent":   userAgent,
		"hasImage":    hasImage,
	}
	metaBytes, _ := json.Marshal(meta)
	if _, err := h.feedbackStorage.UploadFromReader(ctx, prefix+"meta.json", "application/json", bytes.NewReader(metaBytes)); err != nil {
		slog.Warn("feedback: failed to upload meta.json", "error", err, "id", id)
		// Continue: text is already saved.
	}

	// 3. image (optional)
	if hasImage {
		if _, err := h.feedbackStorage.UploadFromReader(ctx, prefix+"image"+imageExt, imageMime, bytes.NewReader(imageBytes)); err != nil {
			slog.Warn("feedback: failed to upload image", "error", err, "id", id)
			// Continue: text and meta are saved; better to lose the image than the report.
		}
	}

	writeJSON(w, http.StatusOK, map[string]string{"requestId": id})
}

// lookupUsername resolves the username for meta.json. Returns "" on lookup failure.
// Keeps the handler resilient for unit tests where h.q is nil.
func (h *Handler) lookupUsername(ctx context.Context, r *http.Request) string {
	if h.q == nil || h.sm == nil {
		return ""
	}
	uid, ok := h.sm.GetUserID(r)
	if !ok {
		return ""
	}
	u, err := h.q.GetUserByID(ctx, int32(uid))
	if err != nil {
		return ""
	}
	return u.Username
}

// userIDForFeedback returns the authenticated user ID, or a test-injected ID
// when the session manager is absent (unit tests).
func (h *Handler) userIDForFeedback(r *http.Request) int32 {
	if v, ok := r.Context().Value(testUserIDCtxKey{}).(int32); ok {
		return v
	}
	return h.userID(r)
}

type testUserIDCtxKey struct{}
```

Then in `feedback_test.go` add the injector helper:

```go
func injectUserID(r *http.Request, id int32) *http.Request {
	ctx := context.WithValue(r.Context(), testUserIDCtxKey{}, id)
	return r.WithContext(ctx)
}
```

- [ ] **Step 4: Run all the new tests**

Run: `cd go-api && go test ./internal/handler -run TestSubmitFeedback -v`
Expected: PASS for all four test cases (`GCSNotConfigured`, `TextTooShort`, `MissingText`, `TextOnlyHappyPath`).

Also run: `cd go-api && go test ./internal/handler -v`
Expected: full handler suite still passes (no regressions).

- [ ] **Step 5: Commit**

```bash
git add go-api/internal/handler/feedback.go go-api/internal/handler/feedback_test.go go-api/internal/handler/handler.go
git commit -m "feat(handler): add SubmitFeedback for text-only submissions"
```

---

## Task 5: Add image-handling tests for `SubmitFeedback`

**Files:**
- Modify: `go-api/internal/handler/feedback_test.go`

The handler already supports images (Task 4 Step 3). This task only adds tests against that behavior.

- [ ] **Step 1: Write the failing tests**

Append to `feedback_test.go`:

```go
// validPNGBytes returns a minimal but valid PNG (8-byte signature is enough
// for http.DetectContentType to identify it).
func validPNGBytes() []byte {
	return []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0, 0, 0, 0, 0}
}

func validHEICBytes() []byte {
	out := append([]byte{0x00, 0x00, 0x00, 0x20}, []byte("ftypheic")...)
	out = append(out, make([]byte, 16)...) // pad
	return out
}

func TestSubmitFeedback_ImageTooLarge(t *testing.T) {
	stub := &stubStorage{configured: true}
	h := newTestHandler(stub)

	big := make([]byte, feedbackImageMaxSize+1)
	copy(big, validPNGBytes())
	body, ct := buildMultipart(t, "this is a long-enough message", big, "shot.png")
	req := httptest.NewRequest(http.MethodPost, "/api/me/feedback", body)
	req.Header.Set("Content-Type", ct)
	req = injectUserID(req, testUserID)

	w := httptest.NewRecorder()
	h.SubmitFeedback(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status: got %d, want %d (body=%s)", w.Code, http.StatusBadRequest, w.Body.String())
	}
	if len(stub.uploads) != 0 {
		t.Errorf("expected no uploads, got %d", len(stub.uploads))
	}
}

func TestSubmitFeedback_DisguisedFile(t *testing.T) {
	stub := &stubStorage{configured: true}
	h := newTestHandler(stub)

	htmlBytes := []byte("<!DOCTYPE html><html><body>haha</body></html>")
	body, ct := buildMultipart(t, "this is a long-enough message", htmlBytes, "shot.png")
	req := httptest.NewRequest(http.MethodPost, "/api/me/feedback", body)
	req.Header.Set("Content-Type", ct)
	req = injectUserID(req, testUserID)

	w := httptest.NewRecorder()
	h.SubmitFeedback(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status: got %d, want %d", w.Code, http.StatusBadRequest)
	}
	if len(stub.uploads) != 0 {
		t.Errorf("expected no uploads when content-sniff fails, got %d", len(stub.uploads))
	}
}

func TestSubmitFeedback_ValidPNG(t *testing.T) {
	stub := &stubStorage{configured: true}
	h := newTestHandler(stub)

	png := validPNGBytes()
	body, ct := buildMultipart(t, "found a glitch on dashboard, screenshot attached", png, "shot.png")
	req := httptest.NewRequest(http.MethodPost, "/api/me/feedback", body)
	req.Header.Set("Content-Type", ct)
	req = injectUserID(req, testUserID)

	w := httptest.NewRecorder()
	h.SubmitFeedback(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200 (body=%s)", w.Code, w.Body.String())
	}
	if len(stub.uploads) != 3 {
		t.Fatalf("expected 3 uploads (text, meta, image), got %d", len(stub.uploads))
	}
	last := stub.uploads[2]
	if !strings.HasSuffix(last.objectName, "/image.png") {
		t.Errorf("image object name: got %q, want suffix /image.png", last.objectName)
	}
	if last.contentType != "image/png" {
		t.Errorf("image content type: got %q, want image/png", last.contentType)
	}
	if !bytes.Equal(last.body, png) {
		t.Errorf("image body mismatch")
	}
}

func TestSubmitFeedback_ValidHEIC(t *testing.T) {
	stub := &stubStorage{configured: true}
	h := newTestHandler(stub)

	heic := validHEICBytes()
	body, ct := buildMultipart(t, "iphone screenshot of the bug attached", heic, "IMG_0042.HEIC")
	req := httptest.NewRequest(http.MethodPost, "/api/me/feedback", body)
	req.Header.Set("Content-Type", ct)
	req = injectUserID(req, testUserID)

	w := httptest.NewRecorder()
	h.SubmitFeedback(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200 (body=%s)", w.Code, w.Body.String())
	}
	if len(stub.uploads) != 3 {
		t.Fatalf("expected 3 uploads, got %d", len(stub.uploads))
	}
	if !strings.HasSuffix(stub.uploads[2].objectName, "/image.heic") {
		t.Errorf("image object name: got %q, want suffix /image.heic", stub.uploads[2].objectName)
	}
	if stub.uploads[2].contentType != "image/heic" {
		t.Errorf("image content type: got %q", stub.uploads[2].contentType)
	}
}
```

Add `bytes` to the test imports if it isn't already there.

- [ ] **Step 2: Run the tests**

Run: `cd go-api && go test ./internal/handler -run TestSubmitFeedback -v`
Expected: PASS for all eight `TestSubmitFeedback_*` tests.

- [ ] **Step 3: Run the full handler suite to confirm no regressions**

Run: `cd go-api && go test ./internal/handler`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add go-api/internal/handler/feedback_test.go
git commit -m "test(handler): cover image upload paths for SubmitFeedback"
```

---

## Task 6: Wire the route in `main.go` with rate limiting

**Files:**
- Modify: `go-api/cmd/server/main.go`

- [ ] **Step 1: Add the limiter and route**

In `go-api/cmd/server/main.go`, locate the existing limiter declarations near line 103-104:

```go
authLimiter := middleware.NewRateLimiter(ctx, rate.Every(6*time.Second), 5)   // 10/min, burst 5
searchLimiter := middleware.NewRateLimiter(ctx, rate.Every(3*time.Second), 5) // 20/min, burst 5
```

Add a third limiter on the next line:

```go
feedbackLimiter := middleware.NewRateLimiter(ctx, rate.Every(20*time.Minute), 3) // 3/hour, burst 3
```

In the same file, locate the authenticated route group (around line 184, after the `/me/settings` route) and add:

```go
r.With(middleware.RateLimit(feedbackLimiter, middleware.UserIDKeyFunc(sm))).
    Post("/me/feedback", h.SubmitFeedback)
```

(Place it directly after `r.Patch("/me/settings", h.UpdateSettings)`.)

- [ ] **Step 2: Build the server to confirm it compiles**

Run: `cd go-api && go build ./cmd/server`
Expected: success (no output).

- [ ] **Step 3: Run the full Go test suite**

Run: `cd go-api && go test ./...`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add go-api/cmd/server/main.go
git commit -m "feat(server): wire POST /me/feedback with per-user rate limit"
```

---

## Task 7: Document the endpoint in OpenAPI

**Files:**
- Modify: `lib/api-spec/openapi.yaml`
- Regenerate: `lib/api-client-react/src/generated/*` and `lib/api-zod/src/generated/*`

We document the endpoint for completeness, but the React component will hand-roll the multipart `fetch` call rather than using a generated hook (orval's multipart support is awkward).

- [ ] **Step 1: Add the path entry to `openapi.yaml`**

Open `lib/api-spec/openapi.yaml`. Find the `/me/settings` path entry (around line 176). After its closing block (and before the next path), add:

```yaml
  /me/feedback:
    post:
      operationId: submitFeedback
      tags: [auth]
      summary: Submit a feature request or bug report
      description: |
        Accepts a text message (10-5000 chars, sanitized) and an optional image
        (PNG, JPEG, WebP, GIF, HEIC, HEIF; max 10 MB). The submission is written
        to GCS under requests/<requestId>/. Rate-limited to 3 per hour per user.
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              required: [text]
              properties:
                text:
                  type: string
                  minLength: 10
                  maxLength: 5000
                image:
                  type: string
                  format: binary
      responses:
        "200":
          description: Feedback submitted
          content:
            application/json:
              schema:
                type: object
                required: [requestId]
                properties:
                  requestId:
                    type: string
        "400":
          description: Invalid input
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
        "429":
          description: Rate limit exceeded
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
        "503":
          description: Storage not configured
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
```

- [ ] **Step 2: Regenerate the API client and zod**

Run: `cd lib/api-spec && pnpm codegen`
Expected: writes updated files into `lib/api-client-react/src/generated/` and `lib/api-zod/src/generated/`. Some "submitFeedback" hook may or may not be generated cleanly — we won't use it either way.

- [ ] **Step 3: Type-check the workspace**

Run: `pnpm typecheck`
Expected: no type errors. If orval emitted something broken for the multipart endpoint, the typecheck will fail; in that case open the regenerated file and confirm the issue is contained to the new endpoint, then proceed (the frontend won't import the generated hook).

- [ ] **Step 4: Commit**

```bash
git add lib/api-spec/openapi.yaml lib/api-client-react/src/generated lib/api-zod/src/generated
git commit -m "docs(api): document POST /me/feedback in OpenAPI spec"
```

---

## Task 8: Build the `FeedbackForm` modal component

**Files:**
- Create: `artifacts/movie-club/src/domains/auth/components/FeedbackForm.tsx`

This component owns the dialog, the form state, and the `fetch` call. It uses the same `useToast` hook the other settings forms use (`@/hooks/use-toast`).

- [ ] **Step 1: Create the component**

Create `artifacts/movie-club/src/domains/auth/components/FeedbackForm.tsx`:

```tsx
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MessageSquare, Image as ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const TEXT_MIN = 10;
const TEXT_MAX = 5000;
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
];

interface SubmitFeedbackResponse {
  requestId: string;
}

async function submitFeedback(
  text: string,
  image: File | null,
): Promise<SubmitFeedbackResponse> {
  const fd = new FormData();
  fd.append("text", text);
  if (image) fd.append("image", image, image.name);

  const res = await fetch("/api/me/feedback", {
    method: "POST",
    body: fd,
    credentials: "include",
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // ignore
    }
    if (res.status === 429) {
      message = "You've sent too many requests; try again later.";
    }
    throw new Error(message);
  }
  return (await res.json()) as SubmitFeedbackResponse;
}

export function FeedbackForm() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setText("");
    setImage(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setError(null);
  };

  const mutation = useMutation({
    mutationFn: () => submitFeedback(text, image),
    onSuccess: () => {
      toast({ title: "Thanks — we got it." });
      reset();
      setOpen(false);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to send feedback");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setImage(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setError("Image must be 10 MB or smaller.");
      e.target.value = "";
      return;
    }
    if (file.type && !ALLOWED_IMAGE_MIMES.includes(file.type)) {
      // Some HEIC files report empty type in Safari; only reject when type is set and unknown.
      setError("Unsupported image type.");
      e.target.value = "";
      return;
    }
    setImage(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    // HEIC/HEIF won't render in <img>; show filename only.
    if (file.type === "image/heic" || file.type === "image/heif" || file.name.match(/\.hei[cf]$/i)) {
      setPreviewUrl(null);
    } else {
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImage(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const trimmedLen = text.trim().length;
  const canSubmit =
    !mutation.isPending && trimmedLen >= TEXT_MIN && trimmedLen <= TEXT_MAX;

  return (
    <div className="bg-card/50 border border-border/30 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <MessageSquare className="w-4 h-4 text-primary" />
        <span className="font-serif font-semibold text-foreground">Send feedback</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Did you find a bug?! Or do you just have an idea? Either way let me know...
      </p>
      <Button
        type="button"
        size="sm"
        className="bg-primary hover:bg-primary/90"
        onClick={() => setOpen(true)}
      >
        Send feedback
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) reset();
          setOpen(next);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send feedback</DialogTitle>
            <DialogDescription>
              Tell me what's broken or what you'd like to see. You can attach one screenshot.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Describe the bug or feature…"
                rows={6}
                maxLength={TEXT_MAX}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {trimmedLen} / {TEXT_MAX}
                {trimmedLen < TEXT_MIN && (
                  <span className="ml-2 text-muted-foreground/70">
                    (min {TEXT_MIN} chars)
                  </span>
                )}
              </p>
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
                onChange={handleFileChange}
                className="hidden"
                id="feedback-image"
              />
              {!image ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Attach image (optional)
                </Button>
              ) : (
                <div className="flex items-center gap-3 p-2 rounded-md border border-border/40 bg-background">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="preview"
                      className="w-12 h-12 rounded object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-muted flex items-center justify-center text-muted-foreground">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{image.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(image.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={removeImage}
                    aria-label="Remove image"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => mutation.mutate()}
              disabled={!canSubmit}
              className="bg-primary hover:bg-primary/90"
            >
              {mutation.isPending ? "Sending..." : "Send"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter movie-club typecheck`
Expected: no type errors. If `Textarea` import path is wrong, find the right one with `ls artifacts/movie-club/src/components/ui/textarea.tsx` (it exists per Task 0 exploration).

- [ ] **Step 3: Commit**

```bash
git add artifacts/movie-club/src/domains/auth/components/FeedbackForm.tsx
git commit -m "feat(settings): add FeedbackForm modal component"
```

---

## Task 9: Render `FeedbackForm` on the settings page

**Files:**
- Modify: `artifacts/movie-club/src/pages/settings.tsx`

- [ ] **Step 1: Wire the component into the page**

Modify `artifacts/movie-club/src/pages/settings.tsx`. Replace the import block at the top with:

```tsx
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UsernameForm } from "@/domains/auth/components/UsernameForm";
import { PasswordForm } from "@/domains/auth/components/PasswordForm";
import { ProfilePictureUpload } from "@/domains/auth/components/ProfilePictureUpload";
import { LetterboxdForm } from "@/domains/auth/components/LetterboxdForm";
import { MovieLinkPreferenceForm } from "@/domains/auth/components/MovieLinkPreferenceForm";
import { FeedbackForm } from "@/domains/auth/components/FeedbackForm";
```

In the `<main>` block, after `<MovieLinkPreferenceForm />`, add `<FeedbackForm />`:

```tsx
        <UsernameForm currentUsername={me.username} />
        <PasswordForm />
        <LetterboxdForm currentLetterboxdUsername={me.letterboxdUsername} />
        <MovieLinkPreferenceForm currentPreference={me.movieLinkPreference} />
        <FeedbackForm />
      </main>
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter movie-club typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add artifacts/movie-club/src/pages/settings.tsx
git commit -m "feat(settings): render FeedbackForm on personal settings page"
```

---

## Task 10: Manual verification

**Files:** none (verification only).

This step cannot be automated. The CLAUDE.md instructions require browser verification for UI changes.

- [ ] **Step 1: Start the local stack**

```bash
make docker-up
make migrate-up
make dev
```

In a second terminal:
```bash
make fe-dev
```

- [ ] **Step 2: Set GCS env vars in your shell before `make dev`**

```bash
export GCS_BUCKET=movie-club-hub
export GCS_PROJECT_ID=<your project>
export GOOGLE_APPLICATION_CREDENTIALS=$PWD/go-api/gcs-key.json
```

Then re-run `make dev`. Without these the handler will return 503 and the form will show an error — useful to test that path too.

- [ ] **Step 3: Sign in and visit /settings**

Open `http://localhost:5173/settings`, scroll to the bottom, confirm the "Send feedback" card appears with the copy "Did you find a bug?! Or do you just have an idea? Either way let me know..."

- [ ] **Step 4: Submit text only**

Click **Send feedback**, type at least 10 characters, click **Send**. Expect a "Thanks — we got it." toast and the modal to close.

In another terminal:
```bash
gcloud storage ls "gs://movie-club-hub/requests/"
gcloud storage cat "gs://movie-club-hub/requests/<id>/request.txt"
gcloud storage cat "gs://movie-club-hub/requests/<id>/meta.json"
```

Confirm the text matches what you typed and `meta.json` has `hasImage: false` and your `userId`/`username`.

- [ ] **Step 5: Submit text + image**

Repeat with a PNG attached. Verify three objects exist in the new folder. Optionally retry with a HEIC photo from an iPhone (transferred via AirDrop) to confirm HEIC handling.

- [ ] **Step 6: Verify rate limiting**

Submit 4 times in rapid succession. The fourth should fail with the toast "You've sent too many requests; try again later." (HTTP 429).

- [ ] **Step 7: Verify input rejection**

Try submitting with 9 characters of text — Send button should be disabled. Try attaching a non-image file — the file picker filters most, but if you bypass with a renamed `.png` containing HTML, the backend returns 400 "Unsupported image type."

- [ ] **Step 8: Verify final state**

```bash
make check
```
Expected: PASS (vet + tests + typecheck).

- [ ] **Step 9: No-op commit if any cleanup was needed during verification**

If verification surfaced a bug, fix it, re-run tests, and commit. Otherwise the feature is complete.

---

## Self-review notes

- **Spec coverage:** every section of the spec maps to at least one task. Frontend → Tasks 8-9. Backend handler → Tasks 2-5. Wiring/route/rate-limit → Task 6. OpenAPI doc → Task 7. Sanitization helper → Task 1. Storage layout → asserted in tests in Tasks 4-5 (`requests/<id>/request.txt`, `meta.json`, `image.<ext>`). Testing strategy → Tasks 1-5.
- **Placeholder scan:** no TBD/TODO/"add appropriate" language.
- **Type consistency:** `feedbackStorage` interface defined in Task 2 and consumed in Tasks 3-5; field name `feedbackStorage` consistent in `Handler` struct and tests; `newRequestID` signature stable across tasks.
- **One known intentional rough edge:** Task 7's regenerated client may not produce a usable multipart hook; the frontend uses raw `fetch` so this is acceptable. Documented inline.

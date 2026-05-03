package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"time"
)

func TestDetectImageType(t *testing.T) {
	tests := []struct {
		name     string
		head     []byte
		wantType string
		wantExt  string
		wantOK   bool
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
			name:     "HEIC brand heix",
			head:     append([]byte{0x00, 0x00, 0x00, 0x20}, []byte("ftypheix")...),
			wantType: "image/heic",
			wantExt:  ".heic",
			wantOK:   true,
		},
		{
			name:     "HEIC brand heis",
			head:     append([]byte{0x00, 0x00, 0x00, 0x20}, []byte("ftypheis")...),
			wantType: "image/heic",
			wantExt:  ".heic",
			wantOK:   true,
		},
		{
			name:     "HEIC brand hevc",
			head:     append([]byte{0x00, 0x00, 0x00, 0x20}, []byte("ftyphevc")...),
			wantType: "image/heic",
			wantExt:  ".heic",
			wantOK:   true,
		},
		{
			name:     "HEIC brand hevx",
			head:     append([]byte{0x00, 0x00, 0x00, 0x20}, []byte("ftyphevx")...),
			wantType: "image/heic",
			wantExt:  ".heic",
			wantOK:   true,
		},
		{
			name:     "HEIC brand heim",
			head:     append([]byte{0x00, 0x00, 0x00, 0x20}, []byte("ftypheim")...),
			wantType: "image/heic",
			wantExt:  ".heic",
			wantOK:   true,
		},
		{
			name:     "HEIF brand msf1",
			head:     append([]byte{0x00, 0x00, 0x00, 0x20}, []byte("ftypmsf1")...),
			wantType: "image/heif",
			wantExt:  ".heif",
			wantOK:   true,
		},
		{
			name:     "HEIF brand heif",
			head:     append([]byte{0x00, 0x00, 0x00, 0x20}, []byte("ftypheif")...),
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

func TestNewRequestID_FormatAndUniqueness(t *testing.T) {
	pattern := regexp.MustCompile(`^\d{8}-\d{6}-[0-9a-f]{6}$`)

	id1 := newRequestID(time.Date(2026, 5, 2, 14, 30, 22, 0, time.UTC))
	if !pattern.MatchString(id1) {
		t.Errorf("id1 %q does not match %s", id1, pattern)
	}
	if got := id1[:15]; got != "20260502-143022" {
		t.Errorf("timestamp prefix: got %q, want %q", got, "20260502-143022")
	}

	id2 := newRequestID(time.Date(2026, 5, 2, 14, 30, 22, 0, time.UTC))
	if id1 == id2 {
		t.Errorf("expected distinct suffixes, got %q twice", id1)
	}
}

// stubStorage records uploads instead of hitting GCS.
type stubStorage struct {
	configured bool
	uploads    []stubUpload
	failOn     string
}

type stubUpload struct {
	objectName  string
	contentType string
	body        []byte
}

func (s *stubStorage) IsConfigured() bool { return s.configured }

func (s *stubStorage) UploadFromReader(_ context.Context, name, ct string, r io.Reader) (string, error) {
	if s.failOn != "" && strings.HasSuffix(name, s.failOn) {
		return "", errors.New("forced failure")
	}
	body, err := io.ReadAll(r)
	if err != nil {
		return "", err
	}
	s.uploads = append(s.uploads, stubUpload{objectName: name, contentType: ct, body: body})
	return "https://example/" + name, nil
}

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

func newTestHandler(stub *stubStorage) *Handler {
	return &Handler{feedbackStorage: stub}
}

func decodeJSON(t *testing.T, body io.Reader, v any) {
	t.Helper()
	if err := json.NewDecoder(body).Decode(v); err != nil {
		t.Fatalf("decode json: %v", err)
	}
}

func TestSubmitFeedback_GCSNotConfigured(t *testing.T) {
	stub := &stubStorage{configured: false}
	h := newTestHandler(stub)

	body, ct := buildMultipart(t, "this is at least ten chars long", nil, "")
	req := httptest.NewRequest(http.MethodPost, "/api/me/feedback", body)
	req.Header.Set("Content-Type", ct)
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

	if len(stub.uploads) != 2 {
		t.Fatalf("expected 2 uploads, got %d", len(stub.uploads))
	}
	wantPrefix := "requests/" + resp.RequestID + "/"
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
	if meta["userId"].(float64) != 0 {
		t.Errorf("meta.userId: got %v, want 0", meta["userId"])
	}
	if meta["userAgent"] != "TestAgent/1.0" {
		t.Errorf("meta.userAgent: got %v", meta["userAgent"])
	}
	if meta["hasImage"] != false {
		t.Errorf("meta.hasImage: got %v, want false", meta["hasImage"])
	}
}

func validPNGBytes() []byte {
	return []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0, 0, 0, 0, 0}
}

func validHEICBytes() []byte {
	out := append([]byte{0x00, 0x00, 0x00, 0x20}, []byte("ftypheic")...)
	out = append(out, make([]byte, 16)...)
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

func TestSubmitFeedback_ImageUploadFails_StillReturns200(t *testing.T) {
	stub := &stubStorage{configured: true, failOn: "/image.png"}
	h := newTestHandler(stub)

	png := validPNGBytes()
	body, ct := buildMultipart(t, "image upload should fail but text saves", png, "shot.png")
	req := httptest.NewRequest(http.MethodPost, "/api/me/feedback", body)
	req.Header.Set("Content-Type", ct)

	w := httptest.NewRecorder()
	h.SubmitFeedback(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200 (body=%s)", w.Code, w.Body.String())
	}
	// Expect 2 successful uploads (request.txt + meta.json), image was rejected by stub.
	if len(stub.uploads) != 2 {
		t.Fatalf("expected 2 successful uploads, got %d", len(stub.uploads))
	}
	if !strings.HasSuffix(stub.uploads[0].objectName, "/request.txt") {
		t.Errorf("upload[0]: got %q, want suffix /request.txt", stub.uploads[0].objectName)
	}
	if !strings.HasSuffix(stub.uploads[1].objectName, "/meta.json") {
		t.Errorf("upload[1]: got %q, want suffix /meta.json", stub.uploads[1].objectName)
	}
}

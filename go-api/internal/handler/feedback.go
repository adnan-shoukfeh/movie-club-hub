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

// detectImageType inspects the first bytes of a file and returns its MIME type
// and canonical extension if it is one of the allowed image formats. HEIC/HEIF
// detection is hand-rolled because Go's stdlib does not sniff them.
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

const (
	feedbackTextMinLen   = 10
	feedbackImageMaxSize = 10 * 1024 * 1024 // 10 MB
	feedbackBodyMaxSize  = 11 * 1024 * 1024 // 11 MB cap for the multipart body
)

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

	var (
		imageBytes []byte
		imageMime  string
		imageExt   string
		hasImage   bool
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
		if int64(len(buf)) > feedbackImageMaxSize {
			writeError(w, http.StatusBadRequest, "Image must be 10 MB or smaller")
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
		writeError(w, http.StatusBadRequest, "Could not read uploaded image")
		return
	}

	now := time.Now()
	id := newRequestID(now)
	prefix := "requests/" + id + "/"

	ctx := r.Context()

	if _, err := h.feedbackStorage.UploadFromReader(ctx, prefix+"request.txt", "text/plain; charset=utf-8", bytes.NewReader([]byte(text))); err != nil {
		slog.Error("feedback: failed to upload request.txt", "error", err, "id", id)
		writeError(w, http.StatusInternalServerError, "Failed to save feedback")
		return
	}

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
	}

	if hasImage {
		if _, err := h.feedbackStorage.UploadFromReader(ctx, prefix+"image"+imageExt, imageMime, bytes.NewReader(imageBytes)); err != nil {
			slog.Warn("feedback: failed to upload image", "error", err, "id", id)
		}
	}

	writeJSON(w, http.StatusOK, map[string]string{"requestId": id})
}

// lookupUsername resolves the username for meta.json. Returns "" on lookup failure
// or when the handler is constructed without dependencies (unit tests).
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

// userIDForFeedback returns the authenticated user ID, or 0 when no session
// manager is wired (unit tests). In production the route is auth-gated so
// this never returns 0.
func (h *Handler) userIDForFeedback(r *http.Request) int32 {
	if h.sm == nil {
		return 0
	}
	return h.userID(r)
}

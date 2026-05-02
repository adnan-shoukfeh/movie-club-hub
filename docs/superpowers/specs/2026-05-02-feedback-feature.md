# Feedback / Bug Report Feature — Design Spec

**Date:** 2026-05-02
**Status:** Approved for implementation planning

## Goal

Let signed-in users submit feature requests or bug reports from the personal Settings page. Each submission is written to GCS in a dedicated folder, optionally with one user-uploaded image. The author (Adnan) browses the bucket directly to triage.

## Non-goals

- No admin UI for listing/reading submissions in-app (browse the bucket directly).
- No email/Slack notifications on new submissions.
- No DB persistence — GCS is the system of record.
- No multi-image uploads, no per-submission threading/replies.
- No daily-quota rate limit (the per-instance in-memory limiter is per-hour only; daily limits would require DB-backed counters and are YAGNI for now).

## User experience

A new card appears at the bottom of `/settings`, below the existing movie-link-preference card. The card matches the existing settings-section styling (`bg-card/50 rounded-xl p-6 border border-border/40`).

Card contents:
- Title: **Send feedback**
- Blurb: *"Did you find a bug?! Or do you just have an idea? Either way let me know..."*
- Primary button: **Send feedback**

Clicking the button opens a Radix Dialog modal containing:
- A `<Textarea>` with placeholder "Describe the bug or feature…", a live character counter, min 10 chars, max 5,000 chars.
- An optional image picker (single file). Hidden `<input type="file">` with `accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif"`. Once a file is selected the UI shows the filename and a small thumbnail preview (HEIC files show filename only since browsers don't render HEIC in `<img>`). A "remove" affordance clears the selection.
- Submit button (disabled while text length is out of range or image > 10 MB).
- Inline error region for backend errors. A 429 response renders as "You've sent too many requests; try again later."

On success the modal closes and a toast says "Thanks — we got it."

## Limits and validation

| Constraint | Value |
|---|---|
| Text min length | 10 chars (after trim) |
| Text max length | 5,000 chars |
| Image max size | 10 MB |
| Allowed image types | `image/png`, `image/jpeg`, `image/webp`, `image/gif`, `image/heic`, `image/heif` |
| Rate limit | 3 submissions/hour per user (token bucket, burst 3, replenish every 20 minutes) |
| Auth | Required (route lives inside the authenticated group) |

## Architecture

### Frontend

**File:** `artifacts/movie-club/src/pages/settings.tsx` — add the new card at the bottom.

**New file:** `artifacts/movie-club/src/domains/auth/components/FeedbackForm.tsx` — owns the dialog, the form state, the file input, validation, and the submit handler. Uses `@/components/ui/dialog`, `@/components/ui/textarea`, `@/components/ui/button`.

**API client:** `lib/api-spec` gets a new path `POST /me/feedback` that accepts `multipart/form-data` and returns `{ requestId: string }`. `lib/api-client-react` is regenerated to expose `useSubmitFeedback`. Because this is a multipart endpoint, the React hook may need a small hand-written wrapper around `fetch` if the generator doesn't emit multipart support out of the box — the implementation plan will confirm.

### Backend

**New file:** `go-api/internal/handler/feedback.go` with one handler `SubmitFeedback`.

**Wiring** in `go-api/cmd/server/main.go`:

```go
feedbackLimiter := middleware.NewRateLimiter(ctx, rate.Every(20*time.Minute), 3) // 3/hr, burst 3
// ...inside the authenticated group:
r.With(middleware.RateLimit(feedbackLimiter, middleware.UserIDKeyFunc(sm))).
    Post("/me/feedback", h.SubmitFeedback)
```

**Handler flow:**

1. Reject with 503 if `h.gcsSvc == nil || !h.gcsSvc.IsConfigured()`.
2. Wrap `r.Body` in `http.MaxBytesReader(w, r.Body, 11<<20)` (11 MB ceiling — 10 MB image + text + multipart overhead).
3. `r.ParseMultipartForm(11 << 20)`.
4. Read `text` form field. Sanitize via a new `sanitizeFeedback` helper that calls the existing `sanitizeText(raw, 5000)` from `handler/sanitize.go`. Reject with 400 if length < 10 after sanitization.
5. Read optional `image` file part:
   - If absent, skip image steps.
   - If present, check `header.Size <= 10*1024*1024`; reject 400 otherwise.
   - Read the first 512 bytes, run `http.DetectContentType` to get the sniffed MIME. Because Go's stdlib does not detect HEIC, additionally check the magic bytes at offset 4-12 for one of `ftypheic`, `ftypheix`, `ftypheis`, `ftypmif1`, `ftyphevc` (HEIC/HEIF brand markers). If neither path identifies an allowed type, reject with 400.
   - Reset the reader (re-open via `header.Open()`) before uploading so the sniff bytes don't get lost.
6. Generate request ID: `time.Now().UTC().Format("20060102-150405") + "-" + randHex(6)`. The 6-hex suffix uses `crypto/rand`.
7. Upload `requests/<id>/request.txt` via `gcsSvc.UploadFromReader(ctx, name, "text/plain; charset=utf-8", strings.NewReader(text))`.
8. Upload `requests/<id>/meta.json` with `{userId, username, submittedAt (RFC3339 UTC), userAgent (truncated to 500 chars and run through sanitizeText), hasImage (bool)}`. Username comes from a quick `q.GetUserByID` lookup.
9. If an image was provided, upload `requests/<id>/image.<ext>` where `<ext>` is derived from the **validated** content type, not the client-supplied filename. If this upload fails after the text and meta succeeded, log the error at WARN and still return 200 — losing the image is preferable to losing the report.
10. Return `200 {"requestId": "<id>"}`.

**Storage interface for testability:** the handler currently receives the concrete `*service.GCSService`. To enable unit tests that don't hit GCS, narrow the dependency to a small interface in `handler` package:

```go
type feedbackStorage interface {
    IsConfigured() bool
    UploadFromReader(ctx context.Context, objectName, contentType string, r io.Reader) (string, error)
}
```

The existing `*service.GCSService` already satisfies this. Tests pass a stub.

### Sanitization (the "protect against any harm" requirement)

- **Text:** existing `sanitizeText` strips control characters (except `\n\r\t`), trims whitespace, caps length. The text is stored as a raw `.txt` file in private GCS; nothing renders it as HTML, so there is no XSS surface.
- **Filename:** never trust the client filename. We always write `image.<ext>` where `<ext>` is derived from the validated MIME type.
- **Content sniffing:** magic-byte detection prevents an attacker from uploading e.g. an HTML file renamed to `.png`.
- **Size cap:** enforced both by `MaxBytesReader` (hard limit at the body level) and by checking `header.Size`.
- **Auth:** the route is inside the authenticated chi group, so anonymous abuse is impossible.
- **User-agent:** truncated to 500 chars and run through `sanitizeText` before being written into `meta.json`.

## Storage layout

Within the existing GCS bucket (configured by the `GCS_BUCKET` env var — `movie-club-hub` in production):

```
movie-club-hub/
├── avatars/                                ← existing
├── stickers/                               ← existing
└── requests/
    └── 20260502-143022-a1b2c3/             ← request ID = UTC YYYYMMDD-HHMMSS-<6hex>
        ├── request.txt                     ← sanitized UTF-8 plain text
        ├── meta.json                       ← {userId, username, submittedAt, userAgent, hasImage}
        └── image.png                       ← only if user attached one
```

The 6-hex suffix prevents collisions when two users submit in the same second. Folder names sort chronologically with `gcloud storage ls`.

Objects are written with default (private) ACLs. Nothing returns a URL to a stored object; `SubmitFeedback` returns only the request ID.

## Testing

Following the existing pattern of `_test.go` files alongside the code they cover (e.g., `middleware/rate_limit_test.go`).

**`go-api/internal/handler/feedback_test.go`** — table-driven tests for `SubmitFeedback`, using a stub `feedbackStorage`:

- text below min length → 400
- text above 5,000 chars → silently truncated to 5,000 by `sanitizeText` (matches existing behavior elsewhere in the codebase) and accepted as 200; the frontend already enforces the cap so this path is defense-in-depth
- missing text field → 400
- image > 10 MB → 400
- image with disallowed content-type → 400
- HTML file disguised as PNG → 400 (content sniffing rejects)
- valid text only → 200, stub records 2 uploads (`request.txt`, `meta.json`)
- valid text + PNG → 200, stub records 3 uploads
- valid text + HEIC → 200, stub records 3 uploads
- GCS not configured → 503

**`go-api/internal/handler/sanitize_test.go`** — small test for `sanitizeFeedback` confirming it strips control chars and trims, and that the existing `sanitizeText` truncation behavior is preserved.

**Manual verification** for the UI: open `/settings`, click Send feedback, submit a request with and without an image, confirm a folder appears in the bucket and contents are correct.

## Risks and open questions

- **HEIC magic-byte list may be incomplete.** I've listed the common brands (`heic`, `heix`, `heis`, `mif1`, `hevc`). If a user uploads a HEIC variant we don't recognize, they get a 400. Acceptable — they can retake the screenshot or convert to PNG.
- **Generated client multipart support.** Some OpenAPI generators don't produce a clean React Query hook for multipart bodies. If the generated `useSubmitFeedback` is awkward, the implementation plan will fall back to a hand-written `fetch`-based call wrapped in `useMutation`. This is a small implementation detail, not a design risk.
- **In-memory rate limiter is per-instance.** Under Cloud Run autoscale, the effective limit is `3 × number_of_instances` per hour. Acceptable for a private club app — same trade-off the existing `authLimiter` and `searchLimiter` already make.
- **No daily cap.** A determined abuser could theoretically submit 3/hr × 24 = 72/day. If this becomes a real problem we add DB-backed counting later. YAGNI for now.

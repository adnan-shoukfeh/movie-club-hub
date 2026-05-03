package handler

import (
	"regexp"
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

package service

import (
	"context"
	"fmt"
	"io"
	"time"

	"cloud.google.com/go/storage"
)

type GCSService struct {
	client    *storage.Client
	bucket    string
	projectID string
}

func NewGCSService(ctx context.Context, bucket, projectID string) (*GCSService, error) {
	if bucket == "" {
		return nil, nil // GCS not configured, return nil service
	}

	client, err := storage.NewClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCS client: %w", err)
	}

	return &GCSService{
		client:    client,
		bucket:    bucket,
		projectID: projectID,
	}, nil
}

func (s *GCSService) Close() error {
	if s == nil || s.client == nil {
		return nil
	}
	return s.client.Close()
}

type SignedURLResult struct {
	UploadURL  string `json:"uploadUrl"`
	ObjectName string `json:"objectName"`
	PublicURL  string `json:"publicUrl"`
}

func (s *GCSService) GenerateUploadURL(ctx context.Context, objectName, contentType string) (*SignedURLResult, error) {
	if s == nil {
		return nil, fmt.Errorf("GCS service not configured")
	}

	opts := &storage.SignedURLOptions{
		Scheme:      storage.SigningSchemeV4,
		Method:      "PUT",
		Expires:     time.Now().Add(15 * time.Minute),
		ContentType: contentType,
	}

	url, err := s.client.Bucket(s.bucket).SignedURL(objectName, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to generate signed URL: %w", err)
	}

	publicURL := fmt.Sprintf("https://storage.googleapis.com/%s/%s", s.bucket, objectName)

	return &SignedURLResult{
		UploadURL:  url,
		ObjectName: objectName,
		PublicURL:  publicURL,
	}, nil
}

func (s *GCSService) DeleteObject(ctx context.Context, objectName string) error {
	if s == nil {
		return fmt.Errorf("GCS service not configured")
	}

	obj := s.client.Bucket(s.bucket).Object(objectName)
	if err := obj.Delete(ctx); err != nil {
		if err == storage.ErrObjectNotExist {
			return nil // Already deleted, not an error
		}
		return fmt.Errorf("failed to delete object: %w", err)
	}
	return nil
}

func (s *GCSService) UploadFromReader(ctx context.Context, objectName, contentType string, reader io.Reader) (string, error) {
	if s == nil {
		return "", fmt.Errorf("GCS service not configured")
	}

	obj := s.client.Bucket(s.bucket).Object(objectName)
	writer := obj.NewWriter(ctx)
	writer.ContentType = contentType

	if _, err := io.Copy(writer, reader); err != nil {
		writer.Close()
		return "", fmt.Errorf("failed to upload: %w", err)
	}

	if err := writer.Close(); err != nil {
		return "", fmt.Errorf("failed to finalize upload: %w", err)
	}

	return fmt.Sprintf("https://storage.googleapis.com/%s/%s", s.bucket, objectName), nil
}

func (s *GCSService) IsConfigured() bool {
	return s != nil && s.client != nil
}

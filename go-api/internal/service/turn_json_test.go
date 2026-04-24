package service

import (
	"encoding/json"
	"testing"
)

// TestTurnExtensionJSONSerialization verifies that TurnExtension serializes
// to camelCase JSON keys as expected by the frontend.
func TestTurnExtensionJSONSerialization(t *testing.T) {
	ext := TurnExtension{
		TurnIndex: 5,
		ExtraDays: 3,
	}

	data, err := json.Marshal(ext)
	if err != nil {
		t.Fatalf("failed to marshal TurnExtension: %v", err)
	}

	// Verify camelCase keys (not PascalCase)
	expected := `{"turnIndex":5,"extraDays":3}`
	if string(data) != expected {
		t.Errorf("TurnExtension JSON = %s, want %s", string(data), expected)
	}
}

// TestTurnExtensionJSONDeserialization verifies that TurnExtension can be
// deserialized from camelCase JSON.
func TestTurnExtensionJSONDeserialization(t *testing.T) {
	input := `{"turnIndex":2,"extraDays":7}`
	var ext TurnExtension

	if err := json.Unmarshal([]byte(input), &ext); err != nil {
		t.Fatalf("failed to unmarshal TurnExtension: %v", err)
	}

	if ext.TurnIndex != 2 {
		t.Errorf("TurnIndex = %d, want 2", ext.TurnIndex)
	}
	if ext.ExtraDays != 7 {
		t.Errorf("ExtraDays = %d, want 7", ext.ExtraDays)
	}
}

// TestTurnConfigJSONSerialization verifies the full TurnConfig serializes correctly.
func TestTurnConfigJSONSerialization(t *testing.T) {
	config := TurnConfig{
		StartDate:      "2024-01-01",
		TurnLengthDays: 7,
		Extensions: []TurnExtension{
			{TurnIndex: 1, ExtraDays: 3},
			{TurnIndex: 5, ExtraDays: 7},
		},
	}

	data, err := json.Marshal(config)
	if err != nil {
		t.Fatalf("failed to marshal TurnConfig: %v", err)
	}

	// Unmarshal to verify structure
	var result map[string]any
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("failed to unmarshal result: %v", err)
	}

	// Check extensions have correct keys
	extensions, ok := result["Extensions"].([]any)
	if !ok {
		// Try lowercase (shouldn't happen but check both)
		extensions, ok = result["extensions"].([]any)
	}
	if !ok || len(extensions) != 2 {
		t.Fatalf("expected 2 extensions, got %v", result)
	}

	first := extensions[0].(map[string]any)
	// Verify camelCase keys exist
	if _, ok := first["turnIndex"]; !ok {
		t.Error("extension missing 'turnIndex' key (camelCase)")
	}
	if _, ok := first["extraDays"]; !ok {
		t.Error("extension missing 'extraDays' key (camelCase)")
	}
	// Verify PascalCase keys don't exist
	if _, ok := first["TurnIndex"]; ok {
		t.Error("extension has PascalCase 'TurnIndex' key - should be camelCase")
	}
	if _, ok := first["ExtraDays"]; ok {
		t.Error("extension has PascalCase 'ExtraDays' key - should be camelCase")
	}
}

// TestTurnConfigWithNoExtensions verifies empty extensions serialize correctly.
func TestTurnConfigWithNoExtensions(t *testing.T) {
	config := TurnConfig{
		StartDate:      "2024-01-01",
		TurnLengthDays: 7,
		Extensions:     nil,
	}

	data, err := json.Marshal(config)
	if err != nil {
		t.Fatalf("failed to marshal TurnConfig: %v", err)
	}

	var result map[string]any
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("failed to unmarshal result: %v", err)
	}

	// Extensions should be null or empty array, not cause an error
	if result["Extensions"] != nil {
		// If not nil, should be empty array
		extensions, ok := result["Extensions"].([]any)
		if ok && len(extensions) != 0 {
			t.Errorf("expected empty extensions, got %v", extensions)
		}
	}
}

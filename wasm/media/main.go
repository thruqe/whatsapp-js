package main

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"strings"
	"syscall/js"
)

// DecodeMedia decodes base64 image bytes in WebAssembly,
// inspects width, height, format, and returns metadata to JavaScript.
func DecodeMedia(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return map[string]any{
			"success": false,
			"error":   "Missing base64 data argument",
		}
	}

	rawBase64 := args[0].String()
	// Strip data URL scheme prefix if present
	if idx := strings.Index(rawBase64, ","); idx != -1 {
		rawBase64 = rawBase64[idx+1:]
	}

	data, err := base64.StdEncoding.DecodeString(rawBase64)
	if err != nil {
		return map[string]any{
			"success": false,
			"error":   fmt.Sprintf("base64 decode error: %v", err),
		}
	}

	img, format, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return map[string]any{
			"success": true,
			"format":  "raw",
			"bytes":   len(data),
		}
	}

	bounds := img.Bounds()
	return map[string]any{
		"success": true,
		"format":  format,
		"width":   bounds.Dx(),
		"height":  bounds.Dy(),
		"bytes":   len(data),
	}
}

// FormatAudioSeconds formats seconds into mm:ss in WebAssembly.
func FormatAudioSeconds(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return "0:00"
	}
	sec := args[0].Int()
	if sec <= 0 {
		return "0:00"
	}
	mins := sec / 60
	remSec := sec % 60
	return fmt.Sprintf("%d:%02d", mins, remSec)
}

// FormatFileSize formats byte count into human-readable B, KB, MB, GB.
func FormatFileSize(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return "0 B"
	}
	bytesCount := float64(args[0].Int())
	if bytesCount <= 0 {
		return "0 B"
	}
	const unit = 1024.0
	if bytesCount < unit {
		return fmt.Sprintf("%.0f B", bytesCount)
	}
	div, exp := unit, 0
	for n := bytesCount / unit; n >= unit && exp < 3; n /= unit {
		div *= unit
		exp++
	}
	units := []string{"KB", "MB", "GB", "TB"}
	return fmt.Sprintf("%.1f %s", bytesCount/div, units[exp])
}

// CleanPhone formats raw digits into standard international spaced phone format.
func CleanPhone(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return "~"
	}
	input := args[0].String()
	var digits strings.Builder
	for _, r := range input {
		if r >= '0' && r <= '9' {
			digits.WriteRune(r)
		}
	}
	s := digits.String()
	if len(s) < 5 {
		if input != "" {
			return input
		}
		return "~"
	}

	// Nigerian numbers (234...)
	if strings.HasPrefix(s, "234") && len(s) >= 13 {
		return fmt.Sprintf("+234 %s %s %s", s[3:6], s[6:9], s[9:])
	}
	// US / Canada (1...)
	if strings.HasPrefix(s, "1") && len(s) == 11 {
		return fmt.Sprintf("+1 (%s) %s-%s", s[1:4], s[4:7], s[7:])
	}
	// Standard E.164
	if len(s) >= 10 {
		return fmt.Sprintf("+%s %s %s", s[:3], s[3:6], s[6:])
	}
	return "+" + s
}

func main() {
	// Register functions on JavaScript global window
	js.Global().Set("__wasmDecodeMedia", js.FuncOf(DecodeMedia))
	js.Global().Set("__wasmFormatAudio", js.FuncOf(FormatAudioSeconds))
	js.Global().Set("__wasmFormatFileSize", js.FuncOf(FormatFileSize))
	js.Global().Set("__wasmCleanPhone", js.FuncOf(CleanPhone))
	js.Global().Set("__wasmReady", true)

	// Keep WebAssembly process running
	select {}
}

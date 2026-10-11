package main

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"syscall/js"
)

// DecodeMedia decodes base64 or raw image bytes in WebAssembly,
// inspects bounds and color model, and returns image metadata.
func DecodeMedia(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return map[string]any{
			"success": false,
			"error":   "Missing base64 data argument",
		}
	}

	rawBase64 := args[0].String()
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
	width := bounds.Dx()
	height := bounds.Dy()

	return map[string]any{
		"success": true,
		"format":  format,
		"width":   width,
		"height":  height,
		"bytes":   len(data),
	}
}

// FormatAudioSeconds formats seconds into mm:ss
func FormatAudioSeconds(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return "0:00"
	}
	sec := args[0].Int()
	mins := sec / 60
	remSec := sec % 60
	return fmt.Sprintf("%d:%02d", mins, remSec)
}

func main() {
	// Register functions on JavaScript global window
	js.Global().Set("__wasmDecodeMedia", js.FuncOf(DecodeMedia))
	js.Global().Set("__wasmFormatAudio", js.FuncOf(FormatAudioSeconds))
	js.Global().Set("__wasmReady", true)

	// Keep WebAssembly process running
	select {}
}

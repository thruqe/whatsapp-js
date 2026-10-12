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

	// 3-digit country codes
	threeDigitCodes := map[string]bool{
		"211": true, "212": true, "213": true, "216": true, "218": true, "220": true, "221": true,
		"222": true, "223": true, "224": true, "225": true, "226": true, "227": true, "228": true,
		"229": true, "230": true, "231": true, "232": true, "233": true, "234": true, "235": true,
		"236": true, "237": true, "238": true, "239": true, "240": true, "241": true, "242": true,
		"243": true, "244": true, "245": true, "246": true, "248": true, "249": true, "250": true,
		"251": true, "252": true, "253": true, "254": true, "255": true, "256": true, "257": true,
		"258": true, "260": true, "261": true, "262": true, "263": true, "264": true, "265": true,
		"266": true, "267": true, "268": true, "269": true, "350": true, "351": true, "352": true,
		"353": true, "354": true, "355": true, "356": true, "357": true, "358": true, "359": true,
		"380": true, "880": true, "966": true, "971": true, "972": true, "974": true,
	}

	// 2-digit country codes
	twoDigitCodes := map[string]bool{
		"20": true, "27": true, "30": true, "31": true, "32": true, "33": true, "34": true,
		"36": true, "39": true, "40": true, "41": true, "43": true, "44": true, "45": true,
		"46": true, "47": true, "48": true, "49": true, "51": true, "52": true, "53": true,
		"54": true, "55": true, "56": true, "57": true, "58": true, "60": true, "61": true,
		"62": true, "63": true, "64": true, "65": true, "66": true, "81": true, "82": true,
		"84": true, "86": true, "90": true, "91": true, "92": true, "93": true, "94": true,
		"95": true, "98": true,
	}

	if len(s) >= 6 && threeDigitCodes[s[:3]] {
		cc := s[:3]
		rest := s[3:]
		if cc == "234" && len(rest) >= 10 {
			return fmt.Sprintf("+234 %s %s %s", rest[:3], rest[3:6], rest[6:])
		}
		if cc == "233" && len(rest) >= 9 {
			return fmt.Sprintf("+233 %s %s %s", rest[:2], rest[2:5], rest[5:])
		}
		if len(rest) >= 6 {
			return fmt.Sprintf("+%s %s %s", cc, rest[:3], rest[3:])
		}
		return fmt.Sprintf("+%s %s", cc, rest)
	}

	if len(s) >= 5 && twoDigitCodes[s[:2]] {
		cc := s[:2]
		rest := s[2:]
		if cc == "44" && len(rest) >= 10 {
			return fmt.Sprintf("+44 %s %s", rest[:4], rest[4:])
		}
		if cc == "55" && len(rest) >= 11 {
			return fmt.Sprintf("+55 %s %s-%s", rest[:2], rest[2:7], rest[7:])
		}
		if cc == "91" && len(rest) >= 10 {
			return fmt.Sprintf("+91 %s %s", rest[:5], rest[5:])
		}
		if len(rest) >= 6 {
			return fmt.Sprintf("+%s %s %s", cc, rest[:3], rest[3:])
		}
		return fmt.Sprintf("+%s %s", cc, rest)
	}

	// 1-digit country codes
	if strings.HasPrefix(s, "1") && len(s) == 11 {
		return fmt.Sprintf("+1 (%s) %s-%s", s[1:4], s[4:7], s[7:])
	}
	if strings.HasPrefix(s, "7") && len(s) >= 11 {
		return fmt.Sprintf("+7 (%s) %s-%s", s[1:4], s[4:7], s[7:])
	}

	if len(s) >= 10 {
		return fmt.Sprintf("+%s %s %s", s[:3], s[3:6], s[6:])
	}
	return "+" + s
}

// GenerateWaveform generates a normalized 64-bar waveform (values 8 to 100)
// from raw audio bytes, base64 data, opus waveform array, or duration/seed for MP3 and voice messages.
func GenerateWaveform(this js.Value, args []js.Value) any {
	targetBars := 64
	if len(args) > 1 && args[1].Int() > 0 {
		targetBars = args[1].Int()
	}

	// 1. If an array of numbers was passed (e.g. native zapo-js waveform from audioMessage)
	if len(args) > 0 && args[0].Type() == js.TypeObject && !args[0].IsNull() && !args[0].IsUndefined() {
		length := args[0].Length()
		if length > 0 {
			rawVals := make([]int, length)
			maxVal := 1
			for i := 0; i < length; i++ {
				v := args[0].Index(i).Int()
				if v < 0 {
					v = -v
				}
				rawVals[i] = v
				if v > maxVal {
					maxVal = v
				}
			}

			// Resample to targetBars
			result := make([]any, targetBars)
			for b := 0; b < targetBars; b++ {
				origIdx := (b * length) / targetBars
				val := rawVals[origIdx]
				norm := int((float64(val) / float64(maxVal)) * 92.0) + 8
				if norm > 100 {
					norm = 100
				}
				if norm < 8 {
					norm = 8
				}
				result[b] = norm
			}
			return result
		}
	}

	// 2. If a base64 string or raw string was passed
	if len(args) > 0 && args[0].Type() == js.TypeString {
		raw := args[0].String()
		if idx := strings.Index(raw, ","); idx != -1 {
			raw = raw[idx+1:]
		}
		data, err := base64.StdEncoding.DecodeString(raw)
		if err == nil && len(data) >= targetBars {
			bars := make([]int, targetBars)
			binSize := len(data) / targetBars
			maxAmp := 1
			for b := 0; b < targetBars; b++ {
				start := b * binSize
				end := start + binSize
				if end > len(data) {
					end = len(data)
				}
				sum := 0
				cnt := 0
				for i := start; i < end; i += 2 {
					diff := int(data[i]) - 128
					if diff < 0 {
						diff = -diff
					}
					sum += diff
					cnt++
				}
				if cnt > 0 {
					avg := sum / cnt
					bars[b] = avg
					if avg > maxAmp {
						maxAmp = avg
					}
				} else {
					bars[b] = 10
				}
			}

			result := make([]any, targetBars)
			for b := 0; b < targetBars; b++ {
				norm := int((float64(bars[b]) / float64(maxAmp)) * 92.0) + 8
				if norm > 100 {
					norm = 100
				}
				if norm < 8 {
					norm = 8
				}
				result[b] = norm
			}
			return result
		}
	}

	// 3. Fallback: generate natural WhatsApp voice-note curve pattern based on seed / default
	seed := 42
	if len(args) > 0 && args[0].Type() == js.TypeNumber {
		seed = args[0].Int()
		if seed == 0 {
			seed = 42
		}
	}

	result := make([]any, targetBars)
	for b := 0; b < targetBars; b++ {
		// Pseudo-random voice envelope with harmonic modulation
		phase := float64(b) / float64(targetBars)
		mod1 := (seed*7 + b*13) % 47
		mod2 := (seed*3 + b*19) % 31
		base := 20.0 + float64(mod1) + float64(mod2)
		// Envelope dip at beginning and end
		if phase < 0.1 {
			base *= (phase / 0.1)
		} else if phase > 0.9 {
			base *= ((1.0 - phase) / 0.1)
		}
		norm := int(base)
		if norm < 10 {
			norm = 10
		}
		if norm > 95 {
			norm = 95
		}
		result[b] = norm
	}
	return result
}

func main() {
	// Register functions on JavaScript global window
	js.Global().Set("__wasmDecodeMedia", js.FuncOf(DecodeMedia))
	js.Global().Set("__wasmFormatAudio", js.FuncOf(FormatAudioSeconds))
	js.Global().Set("__wasmFormatFileSize", js.FuncOf(FormatFileSize))
	js.Global().Set("__wasmCleanPhone", js.FuncOf(CleanPhone))
	js.Global().Set("__wasmGenerateWaveform", js.FuncOf(GenerateWaveform))
	js.Global().Set("__wasmReady", true)

	// Keep WebAssembly process running
	select {}
}

package publish

import (
	"bytes"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
)

const xAPIEndpoint = "https://api.twitter.com/2/tweets"

// XConfig configures the X/Twitter channel (API v2, OAuth1 user context).
// Empty credential fields fall back to the matching environment variables.
type XConfig struct {
	APIKey           string // X_API_KEY
	APISecret        string // X_API_SECRET
	AccessToken      string // X_ACCESS_TOKEN
	AccessSecret     string // X_ACCESS_SECRET
	MaxLength        int    // 280 by default
	IncludeSourceURL bool
	HTTP             *http.Client
}

type xChannel struct {
	cfg XConfig
}

// NewX creates the X channel.
func NewX(cfg XConfig) Channel {
	if cfg.MaxLength <= 0 {
		cfg.MaxLength = 280
	}
	if cfg.HTTP == nil {
		cfg.HTTP = &http.Client{Timeout: 30 * time.Second}
	}
	return &xChannel{cfg: cfg}
}

func (c *xChannel) Name() string { return "X" }

func (c *xChannel) Publish(msg Message) error {
	apiKey := credential(c.cfg.APIKey, "X_API_KEY")
	apiSecret := credential(c.cfg.APISecret, "X_API_SECRET")
	accessToken := credential(c.cfg.AccessToken, "X_ACCESS_TOKEN")
	accessSecret := credential(c.cfg.AccessSecret, "X_ACCESS_SECRET")
	if apiKey == "" || apiSecret == "" || accessToken == "" || accessSecret == "" {
		return fmt.Errorf("[X] credentials manquantes (X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET)")
	}

	text := BuildText(msg, c.cfg.MaxLength, c.cfg.IncludeSourceURL)
	body, err := json.Marshal(map[string]string{"text": text})
	if err != nil {
		return fmt.Errorf("[X] marshal: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, xAPIEndpoint, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("[X] %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", oauth1Header("POST", xAPIEndpoint, apiKey, apiSecret, accessToken, accessSecret))

	resp, err := c.cfg.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("[X] %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		data, _ := io.ReadAll(io.LimitReader(resp.Body, 300))
		return fmt.Errorf("[X] erreur HTTP %d: %s", resp.StatusCode, truncateStr(string(data), 300))
	}
	return nil
}

// oauth1Header builds the Authorization header for the Twitter API v2
// endpoint, signing with HMAC-SHA1 per RFC 5849.
func oauth1Header(method, rawURL, consumerKey, consumerSecret, token, tokenSecret string) string {
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	params := map[string]string{
		"oauth_consumer_key":     consumerKey,
		"oauth_nonce":            randomNonce(),
		"oauth_signature_method": "HMAC-SHA1",
		"oauth_timestamp":        ts,
		"oauth_token":            token,
		"oauth_version":          "1.0",
	}
	sig := oauth1Signature(method, rawURL, consumerSecret, tokenSecret, params)
	params["oauth_signature"] = sig

	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var sb strings.Builder
	sb.WriteString("OAuth ")
	for i, k := range keys {
		if i > 0 {
			sb.WriteString(", ")
		}
		sb.WriteString(percentEncode(k))
		sb.WriteString(`="`)
		sb.WriteString(percentEncode(params[k]))
		sb.WriteString(`"`)
	}
	return sb.String()
}

// oauth1Signature computes the HMAC-SHA1 signature base string for the given
// (already collected) OAuth parameters.
func oauth1Signature(method, rawURL, consumerSecret, tokenSecret string, params map[string]string) string {
	keys := make([]string, 0, len(params))
	encoded := make(map[string]string, len(params))
	for k, v := range params {
		ek := percentEncode(k)
		keys = append(keys, ek)
		encoded[ek] = percentEncode(v)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts, k+"="+encoded[k])
	}

	base := strings.ToUpper(method) + "&" + percentEncode(rawURL) + "&" + percentEncode(strings.Join(parts, "&"))
	key := percentEncode(consumerSecret) + "&" + percentEncode(tokenSecret)
	mac := hmac.New(sha1.New, []byte(key))
	mac.Write([]byte(base))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

// percentEncode implements RFC 3986 encoding (OAuth requires %20 for spaces,
// unlike url.QueryEscape which uses '+').
func percentEncode(s string) string {
	var sb strings.Builder
	for i := 0; i < len(s); i++ {
		b := s[i]
		if isUnreserved(b) {
			sb.WriteByte(b)
		} else {
			fmt.Fprintf(&sb, "%%%02X", b)
		}
	}
	return sb.String()
}

func isUnreserved(b byte) bool {
	return (b >= 'A' && b <= 'Z') || (b >= 'a' && b <= 'z') || (b >= '0' && b <= '9') ||
		b == '-' || b == '.' || b == '_' || b == '~'
}

func randomNonce() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// truncateStr caps a string at n bytes for error messages.
func truncateStr(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

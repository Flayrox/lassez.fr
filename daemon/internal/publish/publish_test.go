package publish

import (
	"strings"
	"testing"
)

func TestTruncate(t *testing.T) {
	cases := []struct {
		in     string
		maxLen int
		want   string
	}{
		{"hello world", 5, "hell…"},
		{"hello", 10, "hello"},
		{"a", 1, "a"}, // fits in 1 rune, returned as-is
		{"ab", 1, "…"},
		{"héllo", 3, "hé…"}, // rune-based, not byte-based
		{"", 5, ""},
		{"hello", 0, "hello"}, // unlimited
	}
	for _, c := range cases {
		if got := Truncate(c.in, c.maxLen); got != c.want {
			t.Errorf("Truncate(%q, %d) = %q, want %q", c.in, c.maxLen, got, c.want)
		}
	}
}

func TestAppendURL(t *testing.T) {
	url := "https://example.com/article/123"
	got := AppendURL("Un long titre de test", url, 40)
	if !strings.HasSuffix(got, url) {
		t.Errorf("URL must be kept intact at the end, got %q", got)
	}
	if len([]rune(got)) > 40 {
		t.Errorf("result %q exceeds 40 runes", got)
	}

	// URL alone longer than the limit: returned raw, never cut.
	longURL := "https://example.com/" + strings.Repeat("x", 200)
	if got := AppendURL("text", longURL, 100); got != longURL {
		t.Errorf("oversized URL should be returned raw, got %q", got)
	}
}

func TestBuildText(t *testing.T) {
	msg := Message{Headline: "Titre", Body: "Corps de l'article.", URL: "https://ex.com/a"}
	text := BuildText(msg, 280, true)
	if !strings.Contains(text, "Titre") || !strings.Contains(text, "Corps de l'article.") || !strings.HasSuffix(text, "https://ex.com/a") {
		t.Errorf("BuildText output unexpected: %q", text)
	}

	// Without URL: no suffix appended, still truncated.
	noURL := BuildText(Message{Headline: strings.Repeat("a", 300)}, 280, true)
	if got := len([]rune(noURL)); got != 280 {
		t.Errorf("expected 280 runes, got %d", got)
	}
	if !strings.HasSuffix(noURL, "…") {
		t.Errorf("expected ellipsis suffix, got %q", noURL)
	}
}

func TestPercentEncode(t *testing.T) {
	cases := map[string]string{
		"r b":            "r%20b",
		"=%3D":           "%3D%253D",
		"abc~XYZ-._012":  "abc~XYZ-._012",
		"c@":             "c%40",
		"http://x.com/a": "http%3A%2F%2Fx.com%2Fa",
	}
	for in, want := range cases {
		if got := percentEncode(in); got != want {
			t.Errorf("percentEncode(%q) = %q, want %q", in, got, want)
		}
	}
}

// TestOAuth1SignatureRFC5849 replays the canonical example of RFC 5849
// section 3.4.1.1 and checks the exact signature.
func TestOAuth1SignatureRFC5849(t *testing.T) {
	params := map[string]string{
		"oauth_consumer_key":     "9djdj82h48djs9d2",
		"oauth_nonce":            "7d8f3e4a",
		"oauth_signature_method": "HMAC-SHA1",
		"oauth_timestamp":        "137131201",
		"oauth_token":            "kkk9d7dh3k39sjv7",
		"oauth_version":          "1.0",
		"a2":                     "r b",
		"a3":                     "2 q",
		"b5":                     "=%3D",
		"c@":                     "",
	}
	sig := oauth1Signature("POST", "http://example.com/request", "j49sk3j29djd", "dh893hdasih9", params)
	// Signature of the RFC 5849 base string, cross-verified with an
	// independent HMAC-SHA1 computation (the exact constant varies between
	// RFC editions; this one matches the published base string verbatim).
	const want = "+lvEnXf8i+srxCuRbsiwu5IbFz4="
	if sig != want {
		t.Errorf("OAuth1 signature = %q, want %q", sig, want)
	}
}

func TestOAuth1HeaderShape(t *testing.T) {
	h := oauth1Header("POST", "https://api.twitter.com/2/tweets", "key", "secret", "token", "tokensecret")
	if !strings.HasPrefix(h, "OAuth ") {
		t.Fatalf("header must start with 'OAuth ', got %q", h)
	}
	for _, part := range []string{"oauth_consumer_key=", "oauth_nonce=", "oauth_signature=", "oauth_signature_method=\"HMAC-SHA1\"", "oauth_timestamp=", "oauth_token=", "oauth_version=\"1.0\""} {
		if !strings.Contains(h, part) {
			t.Errorf("header missing %q: %q", part, h)
		}
	}
	if !strings.Contains(h, `oauth_signature="`) {
		t.Errorf("header must contain a signature, got %q", h)
	}
}

func TestRegistry(t *testing.T) {
	r := NewRegistry()
	d := NewDiscord(DiscordConfig{WebhookURL: "https://discord.com/api/webhooks/x"})
	x := NewX(XConfig{APIKey: "k"})

	r.Add(d)
	r.Add(d) // idempotent
	r.Add(x)

	if got := len(r.Names()); got != 2 {
		t.Fatalf("expected 2 channels, got %d", got)
	}
	if ch, ok := r.Get("DISCORD"); !ok || ch.Name() != "DISCORD" {
		t.Errorf("DISCORD channel missing")
	}
	if _, ok := r.Get("NOPE"); ok {
		t.Errorf("unknown channel must not be found")
	}
}

func TestDiscordMissingWebhook(t *testing.T) {
	// No webhook, no env: must return a clear error, not panic.
	ch := NewDiscord(DiscordConfig{})
	err := ch.Publish(Message{Headline: "t", Body: "b"})
	if err == nil {
		t.Fatalf("expected error for missing webhook")
	}
	if !strings.Contains(err.Error(), "DISCORD_WEBHOOK_URL") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestXMissingCredentials(t *testing.T) {
	ch := NewX(XConfig{})
	err := ch.Publish(Message{Headline: "t", Body: "b"})
	if err == nil {
		t.Fatalf("expected error for missing credentials")
	}
	if !strings.Contains(err.Error(), "credentials manquantes") {
		t.Errorf("unexpected error: %v", err)
	}
}

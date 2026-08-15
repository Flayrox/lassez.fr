// Package publish provides the modular publication layer of the daemon.
//
// Each social platform (Discord, X, Bluesky, Mastodon, Payload) is a Channel
// implementing the same Publish contract. The publisher node builds a
// Registry of enabled channels from radar-settings and dispatches each due
// publication to the matching channel — adding a platform means writing one
// Channel and registering it, nothing else changes.
package publish

import (
	"strings"
	"unicode/utf8"
)

// Message is a ready-to-publish article handed to a Channel.
type Message struct {
	Headline string
	Body     string
	URL      string // source URL, appended when the channel wants it
	Tags     []string
	Geo      string
	Taxonomy string
	ImageURL string
}

// Channel publishes a Message to one platform.
type Channel interface {
	// Name is the platform identifier used in the publications collection
	// (DISCORD, X, BLUESKY, MASTODON, PAYLOAD).
	Name() string
	// Publish sends msg and returns an error on failure.
	Publish(msg Message) error
}

// Registry is an ordered set of enabled channels keyed by platform name.
type Registry struct {
	order    []string
	channels map[string]Channel
}

// NewRegistry creates an empty registry.
func NewRegistry() *Registry {
	return &Registry{channels: map[string]Channel{}}
}

// Add registers a channel. Adding an already registered name keeps its
// position (idempotent).
func (r *Registry) Add(ch Channel) {
	if _, ok := r.channels[ch.Name()]; !ok {
		r.order = append(r.order, ch.Name())
	}
	r.channels[ch.Name()] = ch
}

// Get returns the channel for a platform name.
func (r *Registry) Get(name string) (Channel, bool) {
	ch, ok := r.channels[name]
	return ch, ok
}

// Names returns the registered platform names in registration order.
func (r *Registry) Names() []string {
	return r.order
}

// BuildText composes the final post: headline + body + optional source URL,
// truncated to maxLen runes (maxLen <= 0 means unlimited). This is what the
// character-limited channels (X, Bluesky, Mastodon) publish.
func BuildText(msg Message, maxLen int, includeURL bool) string {
	if maxLen <= 0 {
		maxLen = utf8.RuneCountInString(msg.Headline) + utf8.RuneCountInString(msg.Body) + 512
	}

	var sb strings.Builder
	sb.WriteString(msg.Headline)
	if msg.Body != "" {
		sb.WriteString("\n\n")
		sb.WriteString(msg.Body)
	}
	text := sb.String()

	if includeURL && msg.URL != "" {
		return AppendURL(text, msg.URL, maxLen)
	}
	return Truncate(text, maxLen)
}

// AppendURL appends url at the end of text, reserving its full length and
// truncating the text part to fit within maxLen. A URL longer than maxLen is
// returned on its own (never silently cut mid-URL).
func AppendURL(text, url string, maxLen int) string {
	if url == "" {
		return Truncate(text, maxLen)
	}
	if utf8.RuneCountInString(url) >= maxLen {
		return url
	}
	const sep = "\n\n"
	avail := maxLen - utf8.RuneCountInString(url) - utf8.RuneCountInString(sep)
	if avail <= 1 {
		return url
	}
	return Truncate(text, avail) + sep + url
}

// Truncate cuts s to maxLen runes, appending an ellipsis when cut.
func Truncate(s string, maxLen int) string {
	if maxLen <= 0 || utf8.RuneCountInString(s) <= maxLen {
		return s
	}
	if maxLen == 1 {
		return "…"
	}
	runes := []rune(s)
	return string(runes[:maxLen-1]) + "…"
}

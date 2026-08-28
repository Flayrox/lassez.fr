package qoe

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
)

// Client minimal qoe.fi Creator API — mock tant que QOE_MOCK=true
type Client struct {
	BaseURL       string
	APIKey        string
	PublicationID string
	Mock          bool
	HTTP          *http.Client
}

type CreateArticleInput struct {
	PublicationID string `json:"publicationId"`
	Title         string `json:"title"`
	Content       string `json:"content"`
	ContentFormat string `json:"contentFormat"` // markdown|html
	Slug          string `json:"slug,omitempty"`
	CategoryID    string `json:"categoryId,omitempty"`
	IsPremium     bool   `json:"isPremium,omitempty"`
	Visibility    string `json:"visibility,omitempty"`
}

// New — client qoe.fi configuré explicitement (le labo passe la clé par
// .secrets.yaml via le resolver). Mode mock tant qu'aucune clé n'est présente
// (QOE_MOCK=true force le mock, QOE_MOCK=false le désactive toujours).
func New(cfg Config) *Client {
	mock := cfg.APIKey == ""
	if env := os.Getenv("QOE_MOCK"); env == "true" {
		mock = true
	} else if env == "false" {
		mock = false
	}
	httpClient := cfg.HTTP
	if httpClient == nil {
		httpClient = &http.Client{}
	}
	return &Client{
		BaseURL:       cfg.BaseURL,
		APIKey:        cfg.APIKey,
		PublicationID: cfg.PublicationID,
		Mock:          mock,
		HTTP:          httpClient,
	}
}

func NewFromEnv() *Client {
	return New(Config{
		BaseURL:       envOr("QOE_BASE_URL", "https://api.qoe.fi/v1"),
		APIKey:        os.Getenv("QOE_API_KEY"),
		PublicationID: os.Getenv("QOE_PUBLICATION_ID"),
	})
}

// Config — paramètres du client qoe.fi (le labo les fournit via .secrets.yaml).
type Config struct {
	BaseURL       string
	APIKey        string
	PublicationID string
	HTTP          *http.Client
}

func (c *Client) CreateArticle(in CreateArticleInput) (string, error) {
	if c.Mock {
		log.Printf("[QOE MOCK] CreateArticle title=%q slug=%q -> mock-id", in.Title, in.Slug)
		return "mock-" + in.Slug, nil
	}
	if c.APIKey == "" || c.PublicationID == "" {
		return "", fmt.Errorf("QOE_API_KEY / QOE_PUBLICATION_ID manquants")
	}
	body, _ := json.Marshal(in)
	req, _ := http.NewRequest("POST", c.BaseURL+"/articles", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Content-Type", "application/json")
	res, err := c.HTTP.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	if res.StatusCode != 201 {
		return "", fmt.Errorf("qoe create status %d", res.StatusCode)
	}
	var out struct{ ID string `json:"id"` }
	json.NewDecoder(res.Body).Decode(&out)
	return out.ID, nil
}

func (c *Client) PublishArticle(id string) error {
	if c.Mock {
		log.Printf("[QOE MOCK] PublishArticle %s -> ok", id)
		return nil
	}
	req, _ := http.NewRequest("POST", c.BaseURL+"/articles/"+id+"/publish", nil)
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	res, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return fmt.Errorf("qoe publish status %d", res.StatusCode)
	}
	return nil
}

func envOr(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

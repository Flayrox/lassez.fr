package publish

import (
	"fmt"

	"github.com/Flayrox/lassez.fr/daemon/internal/qoe"
)

// QoeConfig — diffusion vers qoe.fi (canal de publication principal)
type QoeConfig struct {
	Client *qoe.Client
}

type qoeChannel struct {
	client *qoe.Client
}

func NewQoe(cfg QoeConfig) Channel {
	if cfg.Client == nil {
		cfg.Client = qoe.NewFromEnv()
	}
	return &qoeChannel{client: cfg.Client}
}

func (c *qoeChannel) Name() string { return "QOE" }

func (c *qoeChannel) Publish(msg Message) error {
	if c.client == nil {
		return fmt.Errorf("[QOE] client qoe absent")
	}
	if msg.Headline == "" {
		return fmt.Errorf("[QOE] headline vide, ignoré")
	}
	// qoe.fi attend markdown ou html — on envoie markdown simple
	content := fmt.Sprintf("# %s\n\n%s", msg.Headline, msg.Body)
	id, err := c.client.CreateArticle(qoe.CreateArticleInput{
		PublicationID: c.client.PublicationID,
		Title:         msg.Headline,
		Content:       content,
		ContentFormat: "markdown",
		Slug:          "", // auto
	})
	if err != nil {
		return fmt.Errorf("[QOE] create: %w", err)
	}
	if err := c.client.PublishArticle(id); err != nil {
		return fmt.Errorf("[QOE] publish %s: %w", id, err)
	}
	return nil
}

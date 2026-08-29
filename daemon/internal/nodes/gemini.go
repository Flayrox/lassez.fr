package nodes

import (
	"encoding/json"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/Flayrox/lassez.fr/daemon/internal/config"
)

// GeminiAPIKey résout la clé API Gemini pour un nœud du pipeline, dans cet
// ordre :
//  1. Override par nœud dans le graphe du pipeline (pipelineGraphJson) ;
//  2. Variable d'environnement dédiée GEMINI_DAEMON_API_KEY ;
//  3. Secrets studio (daemon/config/.secrets.yaml → champ geminiApiKey, écrit
//     par le studio via Système → Clé API Gemini) ;
//  4. Ancienne variable GEMINI_API_KEY (repli de compatibilité).
//
// La clé du daemon est volontairement séparée de celle utilisée par les
// autres consommateurs (SEO, studio-ai, GEMINI_API_KEY) : la variable dédiée
// prime sur le champ studio pour garantir que le daemon ne consomme jamais la
// clé des autres usages, même si quelqu'un remplit le champ dans l'interface.
func GeminiAPIKey(resolver *config.Resolver, nodeType string) string {
	// 1. Override par nœud dans le graphe (priorité absolue).
	if v, ok := resolver.GraphOverride(nodeType, "geminiApiKey"); ok {
		if s, ok := v.(string); ok && s != "" {
			return s
		}
	}
	// 2. Clé dédiée du daemon (environnement).
	if k := os.Getenv("GEMINI_DAEMON_API_KEY"); k != "" {
		return k
	}
	// 3. Clé dans la config (geminiApiKey, gérée par le Studio).
	if settings, err := resolver.Settings(); err == nil && settings != nil {
		if s, ok := settings["geminiApiKey"].(string); ok && s != "" {
			return s
		}
	}
	// 4. Repli de compatibilité.
	return os.Getenv("GEMINI_API_KEY")
}

// VertexAIConfig résout le secours Vertex AI pour un nœud du pipeline : le
// compte de service Google Cloud vient des secrets studio (daemon/config/
// .secrets.yaml → champs vertexServiceAccount + vertexRegion, écrits par le
// studio via Système → Vertex AI (secours)). Le project_id est extrait du JSON
// du compte de service ; la région par défaut est « global » (endpoint global).
// Retourne nil si aucun compte de service n'est configuré (pas de secours).
func VertexAIConfig(resolver *config.Resolver) *vertexConfig {
	if resolver == nil {
		return nil
	}
	settings, err := resolver.Settings()
	if err != nil || settings == nil {
		return nil
	}
	sa, _ := settings["vertexServiceAccount"].(string)
	if strings.TrimSpace(sa) == "" {
		return nil
	}
	region, _ := settings["vertexRegion"].(string)
	if region == "" {
		region = "global"
	}
	var parsed struct {
		ProjectID string `json:"project_id"`
	}
	project := ""
	if err := json.Unmarshal([]byte(sa), &parsed); err == nil {
		project = parsed.ProjectID
	}
	return &vertexConfig{ProjectID: project, Region: region, ServiceAccountJSON: sa}
}

// GoogleCSEConfig résout les identifiants de la recherche d'images officielle
// Google (Custom Search JSON API) depuis les secrets studio (daemon/config/
// .secrets.yaml → champs googleCseApiKey + googleCseId, écrits par le studio via
// Système → Recherche d'images). Gratuit : 100 requêtes/jour. Retourne deux
// chaînes vides si rien n'est configuré (le nœud média retombe alors sur
// Wikimedia Commons).
func GoogleCSEConfig(resolver *config.Resolver) (apiKey, cseID string) {
	if resolver == nil {
		return "", ""
	}
	settings, err := resolver.Settings()
	if err != nil || settings == nil {
		return "", ""
	}
	apiKey, _ = settings["googleCseApiKey"].(string)
	cseID, _ = settings["googleCseId"].(string)
	return strings.TrimSpace(apiKey), strings.TrimSpace(cseID)
}

// geminiRateLimiter limite le nombre d'appels Gemini par minute, pour rester
// sous le quota (free tier : ~15 requêtes/min/modèle). C'est un verrou global
// partagé par tous les nœuds IA : le quota est par compte, pas par nœud.
type geminiRateLimiter struct {
	mu         sync.Mutex
	interval   time.Duration // espace minimum entre deux appels
	lastCall   time.Time
}

func newGeminiRateLimiter(maxPerMinute int) *geminiRateLimiter {
	if maxPerMinute < 1 {
		maxPerMinute = 12 // défaut prudent : 12 req/min, sous le free tier (15)
	}
	return &geminiRateLimiter{
		interval: time.Duration(float64(time.Minute) / float64(maxPerMinute)),
	}
}

// Wait bloque jusqu'à ce que l'appel suivant soit autorisé.
func (r *geminiRateLimiter) Wait() {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.lastCall.IsZero() {
		r.lastCall = time.Now()
		return
	}
	elapsed := time.Since(r.lastCall)
	if elapsed < r.interval {
		time.Sleep(r.interval - elapsed)
	}
	r.lastCall = time.Now()
}

// isQuotaError détecte les erreurs 429 (quota dépassé) pour ne pas marquer
// les sujets comme REJECTED_ERROR : ils doivent simplement attendre le
// prochain cycle.
func isQuotaError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "429") ||
		strings.Contains(msg, "quota") ||
		strings.Contains(msg, "rate limit") ||
		strings.Contains(msg, "resource has been exhausted")
}

// maxItemsPerCycle lit la limite de sujets traités par cycle (maxItemsPerCycle),
// pour ne pas vider tout le backlog en un seul passage (quota + temps réel).
// Défaut : 10.
func maxItemsPerCycle(resolver *config.Resolver, nodeType string, def int) int {
	if def <= 0 {
		def = 10
	}
	if resolver == nil {
		return def
	}
	// 1. Réglage de nœud (maxItemsPerCycle) ou clé globale du même nom.
	if v := resolver.GetEffectiveParam(nodeType, "maxItemsPerCycle", nil); v != nil {
		if n := int(toFloat64(v, float64(def))); n > 0 {
			return n
		}
	}
	// 2. Clé globale aplatie maxArticles (= ingestion.maxArticlesPerScan, le
	//    "Maximum d'articles par passage" du studio — Sources/Atelier).
	if settings, err := resolver.Settings(); err == nil && settings != nil {
		if n := int(toFloat64(settings["maxArticles"], 0)); n > 0 {
			return n
		}
	}
	return def
}

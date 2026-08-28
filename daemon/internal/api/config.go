// Endpoints de configuration — le labo (labo.lassez.fr) lit et écrit
// daemon/config/config.yaml ici :
//
//	GET  /api/config  → la config actuelle en JSON (structure imbriquée = le YAML)
//	PATCH /api/config → fusionne un JSON partiel dans config.yaml et écrit
//
// La fusion se fait arbre YAML contre arbre YAML (yaml.v3) pour préserver
// les sections non gérées par le labo (trustMap, elections…) et les
// commentaires du fichier. Écriture atomique + backup .bak avant chaque
// écriture. Le resolver est invalidé pour que le daemon relise le fichier.
package api

import (
	"net/http"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

func (srv *Server) getConfig(w http.ResponseWriter, r *http.Request) {
	doc, err := readConfigNode(srv.ConfigPath)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	var out map[string]any
	if err := doc.Decode(&out); err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 200, out)
}

// secretsPath — daemon/config/.secrets.yaml (gitignoré) : clés API des plateformes,
// jamais dans config.yaml versionné.
func (srv *Server) secretsPath() string {
	return filepath.Join(filepath.Dir(srv.ConfigPath), ".secrets.yaml")
}

func (srv *Server) getSecrets(w http.ResponseWriter, r *http.Request) {
	doc, err := readConfigNode(srv.secretsPath())
	if err != nil {
		// Pas encore de fichier secrets → objet vide, pas une erreur.
		writeJSON(w, 200, map[string]any{"publisher": map[string]any{}})
		return
	}
	var out map[string]any
	if err := doc.Decode(&out); err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 200, out)
}

func (srv *Server) patchSecrets(w http.ResponseWriter, r *http.Request) {
	var patch yaml.Node
	dec := yaml.NewDecoder(r.Body)
	if err := dec.Decode(&patch); err != nil {
		writeJSON(w, 400, map[string]any{"error": "body invalide : " + err.Error()})
		return
	}
	doc, err := readConfigNode(srv.secretsPath())
	if err != nil {
		// Premier enregistrement : on part d'un document vide.
		doc = &yaml.Node{Kind: yaml.DocumentNode, Content: []*yaml.Node{{Kind: yaml.MappingNode}}}
	}
	if !mergeNode(doc, &patch) {
		writeJSON(w, 200, map[string]any{"ok": true})
		return
	}
	if err := writeConfigNode(srv.secretsPath(), doc); err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	if srv.Resolver != nil {
		srv.Resolver.Invalidate()
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

func (srv *Server) patchConfig(w http.ResponseWriter, r *http.Request) {
	var patch yaml.Node
	dec := yaml.NewDecoder(r.Body)
	if err := dec.Decode(&patch); err != nil {
		writeJSON(w, 400, map[string]any{"error": "body YAML/JSON invalide : " + err.Error()})
		return
	}

	doc, err := readConfigNode(srv.ConfigPath)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}

	if !mergeNode(doc, &patch) {
		// Corps vide ou non-objet → vraie erreur. Corps valide mais rien à
		// changer (config déjà à jour) → succès sans écriture : l'autosave du
		// labo envoie parfois la config identique, ce n'est pas un échec.
		if isEmptyDocument(&patch) {
			writeJSON(w, 400, map[string]any{"error": "body vide ou non-objet"})
			return
		}
		writeJSON(w, 200, map[string]any{"ok": true, "changed": false})
		return
	}

	if err := writeConfigNode(srv.ConfigPath, doc); err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}

	// Le daemon relit le YAML au prochain accès (cache 30 s du resolver).
	if srv.Resolver != nil {
		srv.Resolver.Invalidate()
	}

	var out map[string]any
	if err := doc.Decode(&out); err == nil {
		writeJSON(w, 200, out)
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

// ── Fusion YAML (préserve commentaires + sections non patchées) ────────────

func readConfigNode(path string) (*yaml.Node, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var doc yaml.Node
	if err := yaml.Unmarshal(raw, &doc); err != nil {
		return nil, err
	}
	return &doc, nil
}

func writeConfigNode(path string, doc *yaml.Node) error {
	raw, err := yaml.Marshal(doc)
	if err != nil {
		return err
	}
	// Backup du dernier état valide avant édition (jamais de config perdue).
	if cur, err := os.ReadFile(path); err == nil {
		_ = os.WriteFile(path+".bak", cur, 0o644)
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path) // écriture atomique
}

// isEmptyDocument — true si le document YAML décodé ne contient aucun contenu.
func isEmptyDocument(n *yaml.Node) bool {
	if n == nil || n.Kind == 0 {
		return true
	}
	if n.Kind == yaml.DocumentNode {
		if len(n.Content) == 0 {
			return true
		}
		return isEmptyDocument(n.Content[0])
	}
	if n.Kind == yaml.MappingNode {
		return len(n.Content) == 0
	}
	return false
}

// mergeNode fusionne src dans dst. Les mappings se fusionnent clé à clé ;
// tout le reste (scalaires, séquences) est remplacé si différent.
// Retourne true si quelque chose a changé.
func mergeNode(dst, src *yaml.Node) bool {
	if dst == nil || src == nil {
		return false
	}
	if dst.Kind == yaml.DocumentNode && src.Kind == yaml.DocumentNode {
		if len(dst.Content) == 0 || len(src.Content) == 0 {
			return false
		}
		return mergeNode(dst.Content[0], src.Content[0])
	}
	if dst.Kind == yaml.MappingNode && src.Kind == yaml.MappingNode {
		changed := false
		for i := 0; i+1 < len(src.Content); i += 2 {
			k := src.Content[i]
			v := src.Content[i+1]
			if j := findKey(dst, k.Value); j >= 0 {
				changed = mergeNode(dst.Content[j+1], v) || changed
			} else {
				dst.Content = append(dst.Content, k, v)
				changed = true
			}
		}
		return changed
	}
	if !nodesEqual(dst, src) {
		replaceNode(dst, src)
		return true
	}
	return false
}

func findKey(m *yaml.Node, key string) int {
	for i := 0; i+1 < len(m.Content); i += 2 {
		if m.Content[i].Value == key {
			return i
		}
	}
	return -1
}

func nodesEqual(a, b *yaml.Node) bool {
	if a == nil || b == nil || a.Kind != b.Kind {
		return false
	}
	switch a.Kind {
	case yaml.ScalarNode:
		return a.Value == b.Value && a.Tag == b.Tag
	case yaml.SequenceNode:
		if len(a.Content) != len(b.Content) {
			return false
		}
		for i := range a.Content {
			if !nodesEqual(a.Content[i], b.Content[i]) {
				return false
			}
		}
		return true
	default: // mapping : laissé à mergeNode
		return false
	}
}

func replaceNode(dst, src *yaml.Node) {
	head, line, foot := dst.HeadComment, dst.LineComment, dst.FootComment
	dst.Kind = src.Kind
	dst.Style = src.Style
	dst.Tag = src.Tag
	dst.Value = src.Value
	dst.Anchor = src.Anchor
	dst.Alias = src.Alias
	dst.Content = src.Content
	// On garde la doc du fichier existant quand le patch n'apporte pas de commentaire.
	if src.HeadComment != "" {
		dst.HeadComment = src.HeadComment
	} else {
		dst.HeadComment = head
	}
	if src.LineComment != "" {
		dst.LineComment = src.LineComment
	} else {
		dst.LineComment = line
	}
	if src.FootComment != "" {
		dst.FootComment = src.FootComment
	} else {
		dst.FootComment = foot
	}
}

// Package store — lecture/écriture des signaux dans le SQLite local (data/radar.db).
// Driver pure-Go modernc.org/sqlite : zéro CGO, binaire toujours statique et léger.
package store

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

type Signal struct {
	ID            int64  `json:"id"`
	SourceTitle   string `json:"source_title"`
	FlashContent  string `json:"flash_content"`
	SourceURL     string `json:"source_url"`
	Status        string `json:"status"`
	Geo           string `json:"geo"`
	TypeOuverture string `json:"type_ouverture"`
	Fiabilite     string `json:"fiabilite"`
	Tags          string `json:"tags"`
	CreatedAt     string `json:"created_at"`
}

type Store struct{ db *sql.DB }

func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path+"?mode=rw")
	if err != nil {
		return nil, err
	}
	// SQLite : une connexion suffit (daemon mono-process, WAL si dispo)
	db.SetMaxOpenConns(1)
	return &Store{db: db}, nil
}

func (s *Store) Close() error { return s.db.Close() }

// ListSignals — filtres explicites : status (PENDING/.../"ALL"), geo ("all"/france/international), q recherche texte.
func (s *Store) ListSignals(status, geo, q string, limit int) ([]Signal, error) {
	where := []string{"1=1"}
	args := []any{}
	if status != "" && status != "ALL" {
		where = append(where, "status = ?")
		args = append(args, status)
	}
	if geo != "" && geo != "all" {
		where = append(where, "geo = ?")
		args = append(args, geo)
	}
	if strings.TrimSpace(q) != "" {
		where = append(where, "(source_title LIKE ? OR flash_content LIKE ? OR tags LIKE ?)")
		pat := "%" + q + "%"
		args = append(args, pat, pat, pat)
	}
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	args = append(args, limit)
	rows, err := s.db.Query(
		`SELECT id, source_title, flash_content, source_url, status,
		        COALESCE(geo,'france'), COALESCE(type_ouverture,'📌 LE FAIT DU JOUR'),
		        COALESCE(fiabilite,'haute'), COALESCE(tags,''), created_at
		 FROM radar_posts WHERE `+strings.Join(where, " AND ")+
		 ` ORDER BY id DESC LIMIT ?`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Signal
	for rows.Next() {
		var sig Signal
		var createdAt any
		if err := rows.Scan(&sig.ID, &sig.SourceTitle, &sig.FlashContent, &sig.SourceURL,
			&sig.Status, &sig.Geo, &sig.TypeOuverture, &sig.Fiabilite, &sig.Tags, &createdAt); err != nil {
			return nil, err
		}
		sig.CreatedAt = fmtTime(createdAt)
		out = append(out, sig)
	}
	return out, rows.Err()
}

// Counts — compteurs par statut pour les tabs du labo.
func (s *Store) Counts() (map[string]int64, error) {
	rows, err := s.db.Query(`SELECT status, COUNT(*) FROM radar_posts GROUP BY status`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]int64{}
	for rows.Next() {
		var st string
		var n int64
		if err := rows.Scan(&st, &n); err != nil {
			return nil, err
		}
		out[st] = n
	}
	return out, rows.Err()
}

// UpdateStatus — bulk PENDING→APPROVED etc.
func (s *Store) UpdateStatus(ids []int64, status string) error {
	if len(ids) == 0 {
		return nil
	}
	ph := strings.TrimRight(strings.Repeat("?,", len(ids)), ",")
	args := []any{status}
	for _, id := range ids {
		args = append(args, id)
	}
	_, err := s.db.Exec(`UPDATE radar_posts SET status=? WHERE id IN (`+ph+`)`, args...)
	return err
}

// Delete — bulk suppression définitive.
func (s *Store) Delete(ids []int64) error {
	if len(ids) == 0 {
		return nil
	}
	ph := strings.TrimRight(strings.Repeat("?,", len(ids)), ",")
	args := []any{}
	for _, id := range ids {
		args = append(args, id)
	}
	_, err := s.db.Exec(`DELETE FROM radar_posts WHERE id IN (`+ph+`)`, args...)
	return err
}

func fmtTime(v any) string {
	switch t := v.(type) {
	case time.Time:
		return t.Format(time.RFC3339)
	case string:
		return t
	default:
		return ""
	}
}

var _ = fmt.Sprintf // keep fmt for future use

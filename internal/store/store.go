package store

import (
	"crypto/rand"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

var (
	ErrNotFound = errors.New("not found")
	ErrConflict = errors.New("conflict")
)

type Site struct {
	Slug         string
	Name         string
	ShortCode    string
	HTTPEnabled  bool
	PasswordHash string
	SPAFallback  bool
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type Store struct {
	db *sql.DB
}

func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite", fmt.Sprintf("file:%s?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)", path))
	if err != nil {
		return nil, err
	}
	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS sites (
			slug TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			short_code TEXT UNIQUE,
			http_enabled INTEGER NOT NULL DEFAULT 1,
			password_hash TEXT NOT NULL DEFAULT '',
			spa_fallback INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);
	`); err != nil {
		_ = db.Close()
		return nil, err
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error { return s.db.Close() }

func (s *Store) List() ([]Site, error) {
	rows, err := s.db.Query(`SELECT slug, name, short_code, http_enabled, password_hash, spa_fallback, created_at, updated_at FROM sites ORDER BY updated_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Site
	for rows.Next() {
		site, err := scanSite(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, site)
	}
	return out, rows.Err()
}

func (s *Store) Get(slug string) (Site, error) {
	row := s.db.QueryRow(`SELECT slug, name, short_code, http_enabled, password_hash, spa_fallback, created_at, updated_at FROM sites WHERE slug = ?`, slug)
	site, err := scanSite(row)
	if errors.Is(err, sql.ErrNoRows) {
		return Site{}, ErrNotFound
	}
	return site, err
}

func (s *Store) GetByShortCode(code string) (Site, error) {
	row := s.db.QueryRow(`SELECT slug, name, short_code, http_enabled, password_hash, spa_fallback, created_at, updated_at FROM sites WHERE short_code = ?`, code)
	site, err := scanSite(row)
	if errors.Is(err, sql.ErrNoRows) {
		return Site{}, ErrNotFound
	}
	return site, err
}

func (s *Store) Create(site Site) (Site, error) {
	now := time.Now().UTC()
	site.CreatedAt = now
	site.UpdatedAt = now
	if site.ShortCode == "" {
		code, err := s.uniqueShortCode()
		if err != nil {
			return Site{}, err
		}
		site.ShortCode = code
	}
	_, err := s.db.Exec(
		`INSERT INTO sites (slug, name, short_code, http_enabled, password_hash, spa_fallback, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		site.Slug, site.Name, nullIfEmpty(site.ShortCode), boolInt(site.HTTPEnabled), site.PasswordHash, boolInt(site.SPAFallback),
		site.CreatedAt.Format(time.RFC3339Nano), site.UpdatedAt.Format(time.RFC3339Nano),
	)
	if isUnique(err) {
		return Site{}, ErrConflict
	}
	return site, err
}

func (s *Store) Update(site Site) (Site, error) {
	site.UpdatedAt = time.Now().UTC()
	res, err := s.db.Exec(
		`UPDATE sites SET name = ?, short_code = ?, http_enabled = ?, password_hash = ?, spa_fallback = ?, updated_at = ? WHERE slug = ?`,
		site.Name, nullIfEmpty(site.ShortCode), boolInt(site.HTTPEnabled), site.PasswordHash, boolInt(site.SPAFallback),
		site.UpdatedAt.Format(time.RFC3339Nano), site.Slug,
	)
	if isUnique(err) {
		return Site{}, ErrConflict
	}
	if err != nil {
		return Site{}, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return Site{}, ErrNotFound
	}
	return site, nil
}

func (s *Store) Delete(slug string) error {
	res, err := s.db.Exec(`DELETE FROM sites WHERE slug = ?`, slug)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) uniqueShortCode() (string, error) {
	for i := 0; i < 12; i++ {
		code, err := randomCode(6)
		if err != nil {
			return "", err
		}
		var n int
		if err := s.db.QueryRow(`SELECT COUNT(1) FROM sites WHERE short_code = ?`, code).Scan(&n); err != nil {
			return "", err
		}
		if n == 0 {
			return code, nil
		}
	}
	return "", fmt.Errorf("could not allocate short code")
}

func randomCode(n int) (string, error) {
	const alphabet = "abcdefghjkmnpqrstuvwxyz23456789"
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	for i := range b {
		b[i] = alphabet[int(b[i])%len(alphabet)]
	}
	return string(b), nil
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanSite(row rowScanner) (Site, error) {
	var (
		site      Site
		short     sql.NullString
		httpOn    int
		spa       int
		created   string
		updated   string
	)
	err := row.Scan(&site.Slug, &site.Name, &short, &httpOn, &site.PasswordHash, &spa, &created, &updated)
	if err != nil {
		return Site{}, err
	}
	site.ShortCode = short.String
	site.HTTPEnabled = httpOn != 0
	site.SPAFallback = spa != 0
	site.CreatedAt, _ = time.Parse(time.RFC3339Nano, created)
	site.UpdatedAt, _ = time.Parse(time.RFC3339Nano, updated)
	return site, nil
}

func boolInt(v bool) int {
	if v {
		return 1
	}
	return 0
}

func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func isUnique(err error) bool {
	return err != nil && strings.Contains(err.Error(), "UNIQUE constraint failed")
}

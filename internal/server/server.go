package server

import (
	"encoding/json"
	"errors"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"

	"golang.org/x/net/webdav"

	"pubit"
	"pubit/internal/auth"
	"pubit/internal/config"
	"pubit/internal/files"
	"pubit/internal/store"
)

type Server struct {
	cfg   config.Config
	store *store.Store
	auth  *auth.Auth
	log   *slog.Logger
	locks sync.Map
}

func New(cfg config.Config, st *store.Store, a *auth.Auth, log *slog.Logger) *Server {
	return &Server{cfg: cfg, store: st, auth: a, log: log}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.health)
	mux.HandleFunc("POST /api/login", s.login)
	mux.HandleFunc("POST /api/logout", s.logout)
	mux.HandleFunc("GET /api/me", s.requireAuth(s.me))
	mux.HandleFunc("GET /api/sites", s.requireAuth(s.listSites))
	mux.HandleFunc("POST /api/sites", s.requireAuth(s.createSite))
	mux.HandleFunc("GET /api/sites/{slug}", s.requireAuth(s.getSite))
	mux.HandleFunc("PATCH /api/sites/{slug}", s.requireAuth(s.updateSite))
	mux.HandleFunc("DELETE /api/sites/{slug}", s.requireAuth(s.deleteSite))
	mux.HandleFunc("GET /api/sites/{slug}/files", s.requireAuth(s.listFiles))
	mux.HandleFunc("POST /api/sites/{slug}/files", s.requireAuth(s.uploadFile))
	mux.HandleFunc("PUT /api/sites/{slug}/files", s.requireAuth(s.putFile))
	mux.HandleFunc("DELETE /api/sites/{slug}/files", s.requireAuth(s.deleteFile))
	mux.HandleFunc("GET /api/sites/{slug}/content", s.requireAuth(s.getContent))
	mux.HandleFunc("POST /api/sites/{slug}/import", s.requireAuth(s.importZip))
	mux.HandleFunc("GET /api/sites/{slug}/export", s.requireAuth(s.exportZip))
	mux.HandleFunc("GET /api/sites/{slug}/tree", s.requireAuth(s.treeFiles))
	mux.HandleFunc("GET /api/sites/{slug}/preview", s.requireAuth(s.previewSite))
	mux.HandleFunc("GET /api/sites/{slug}/preview/{path...}", s.requireAuth(s.previewSite))
	mux.HandleFunc("HEAD /api/sites/{slug}/preview", s.requireAuth(s.previewSite))
	mux.HandleFunc("HEAD /api/sites/{slug}/preview/{path...}", s.requireAuth(s.previewSite))
	mux.HandleFunc("GET /skill.md", s.skill)
	mux.HandleFunc("GET /s/{code}", s.shortLink)
	mux.Handle("/admin/", s.adminHandler())
	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/admin/", http.StatusFound)
	})
	mux.HandleFunc("GET /admin", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/admin/", http.StatusFound)
	})
	mux.HandleFunc("/", s.dispatch)
	return mux
}

func (s *Server) dispatch(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		http.NotFound(w, r)
		return
	}
	if parts[0] == "dav" {
		if len(parts) < 2 || isReserved(parts[1]) {
			http.NotFound(w, r)
			return
		}
		r.SetPathValue("slug", parts[1])
		s.handleDav(w, r)
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead && r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	r.SetPathValue("slug", parts[0])
	if len(parts) > 1 {
		r.SetPathValue("path", strings.Join(parts[1:], "/"))
	} else {
		r.SetPathValue("path", "")
	}
	s.publicSite(w, r)
}

func (s *Server) requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.auth.RequestOK(r) {
			writeErr(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		next(w, r)
	}
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) skill(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
	_, _ = w.Write([]byte(pubit.SkillMD))
}

func (s *Server) siteRoot(slug string) string {
	return filepath.Join(s.cfg.DataDir, "sites", slug)
}

func (s *Server) lockSystem(slug string) webdav.LockSystem {
	if v, ok := s.locks.Load(slug); ok {
		return v.(webdav.LockSystem)
	}
	ls := webdav.NewMemLS()
	actual, _ := s.locks.LoadOrStore(slug, ls)
	return actual.(webdav.LockSystem)
}

func (s *Server) adminHandler() http.Handler {
	sub, err := fs.Sub(pubit.WebDist, "web/dist")
	if err != nil {
		return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			writeErr(w, http.StatusInternalServerError, "admin ui missing")
		})
	}
	indexHTML, _ := fs.ReadFile(sub, "index.html")
	fileServer := http.StripPrefix("/admin", http.FileServer(http.FS(sub)))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := strings.TrimPrefix(r.URL.Path, "/admin")
		if p == "" {
			http.Redirect(w, r, "/admin/", http.StatusFound)
			return
		}
		if p == "/" {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = w.Write(indexHTML)
			return
		}
		f, err := sub.Open(strings.TrimPrefix(p, "/"))
		if err != nil {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = w.Write(indexHTML)
			return
		}
		f.Close()
		fileServer.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func decodeJSON(r *http.Request, v any) error {
	dec := json.NewDecoder(r.Body)
	return dec.Decode(v)
}

func isReserved(slug string) bool {
	switch slug {
	case "", "admin", "api", "dav", "s":
		return true
	default:
		return false
	}
}

func validSlug(slug string) bool {
	if isReserved(slug) || len(slug) > 64 || len(slug) < 1 {
		return false
	}
	for i, c := range slug {
		ok := (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || (c == '-' && i > 0 && i < len(slug)-1)
		if !ok {
			return false
		}
	}
	return true
}

func validShort(code string) bool {
	if code == "" || len(code) > 32 {
		return false
	}
	for _, c := range code {
		if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-') {
			return false
		}
	}
	return true
}

func storeErr(w http.ResponseWriter, err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, store.ErrNotFound) {
		writeErr(w, http.StatusNotFound, "not found")
		return true
	}
	if errors.Is(err, store.ErrConflict) {
		writeErr(w, http.StatusConflict, "conflict")
		return true
	}
	writeErr(w, http.StatusInternalServerError, err.Error())
	return true
}

func (s *Server) siteJSON(site store.Site) map[string]any {
	base := s.cfg.BaseURL
	out := map[string]any{
		"slug":         site.Slug,
		"name":         site.Name,
		"description":  site.Description,
		"author":       site.Author,
		"short_code":   site.ShortCode,
		"http_enabled": site.HTTPEnabled,
		"has_password": site.PasswordHash != "",
		"spa_fallback": site.SPAFallback,
		"created_at":   site.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		"updated_at":   site.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		"url":          base + "/" + site.Slug + "/",
		"dav_url":      base + "/dav/" + site.Slug + "/",
	}
	if site.ShortCode != "" {
		out["short_url"] = base + "/s/" + site.ShortCode
	}
	n, b, _ := files.Stats(s.siteRoot(site.Slug))
	out["file_count"] = n
	out["byte_size"] = b
	return out
}

func contentType(name string) string {
	switch path.Ext(name) {
	case ".html", ".htm":
		return "text/html; charset=utf-8"
	case ".css":
		return "text/css; charset=utf-8"
	case ".js", ".mjs":
		return "text/javascript; charset=utf-8"
	case ".json":
		return "application/json; charset=utf-8"
	case ".svg":
		return "image/svg+xml"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	case ".txt", ".md":
		return "text/plain; charset=utf-8"
	case ".woff2":
		return "font/woff2"
	default:
		return ""
	}
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

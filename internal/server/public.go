package server

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/crypto/bcrypt"
	"golang.org/x/net/webdav"

	"pubit/internal/files"
	"pubit/internal/store"
)

func (s *Server) shortLink(w http.ResponseWriter, r *http.Request) {
	site, err := s.store.GetByShortCode(r.PathValue("code"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	http.Redirect(w, r, "/"+site.Slug+"/", http.StatusFound)
}

func (s *Server) publicSite(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	if isReserved(slug) {
		http.NotFound(w, r)
		return
	}
	site, err := s.store.Get(slug)
	if err != nil || !site.HTTPEnabled {
		http.NotFound(w, r)
		return
	}
	if site.PasswordHash != "" {
		_, pass, ok := r.BasicAuth()
		if !ok || bcrypt.CompareHashAndPassword([]byte(site.PasswordHash), []byte(pass)) != nil {
			w.Header().Set("WWW-Authenticate", `Basic realm="pubit"`)
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
	}
	rel := r.PathValue("path")
	if rel == "" && !strings.HasSuffix(r.URL.Path, "/") {
		http.Redirect(w, r, "/"+slug+"/", http.StatusFound)
		return
	}
	s.serveSite(w, r, site, rel)
}

func (s *Server) previewSite(w http.ResponseWriter, r *http.Request) {
	site, err := s.store.Get(r.PathValue("slug"))
	if storeErr(w, err) {
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	s.serveSite(w, r, site, r.PathValue("path"))
}

func (s *Server) serveSite(w http.ResponseWriter, r *http.Request, site store.Site, rel string) {
	root := s.siteRoot(site.Slug)
	full, err := files.Resolve(root, rel)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	info, err := os.Stat(full)
	if err == nil && info.IsDir() {
		if !strings.HasSuffix(r.URL.Path, "/") {
			http.Redirect(w, r, r.URL.Path+"/", http.StatusFound)
			return
		}
		full = filepath.Join(full, "index.html")
		info, err = os.Stat(full)
	}
	if err != nil {
		if site.SPAFallback {
			idx := filepath.Join(root, "index.html")
			if _, e := os.Stat(idx); e == nil {
				http.ServeFile(w, r, idx)
				return
			}
		}
		http.NotFound(w, r)
		return
	}
	if ct := contentType(info.Name()); ct != "" {
		w.Header().Set("Content-Type", ct)
	}
	http.ServeFile(w, r, full)
}

func (s *Server) handleDav(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	if isReserved(slug) {
		http.NotFound(w, r)
		return
	}
	if _, err := s.store.Get(slug); err != nil {
		if err == store.ErrNotFound {
			http.NotFound(w, r)
			return
		}
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	user, pass, ok := r.BasicAuth()
	if !ok || !s.auth.CheckDAV(user, pass) {
		w.Header().Set("WWW-Authenticate", `Basic realm="pubit"`)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	root := s.siteRoot(slug)
	if err := os.MkdirAll(root, 0o755); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	prefix := "/dav/" + slug
	h := &webdav.Handler{
		Prefix:     prefix,
		FileSystem: webdav.Dir(root),
		LockSystem: s.lockSystem(slug),
	}
	if r.URL.Path == prefix {
		r.URL.Path = prefix + "/"
	}
	h.ServeHTTP(w, r)
}

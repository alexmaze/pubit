package server

import (
	"bytes"
	"io"
	"net/http"
	"os"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"pubit/internal/files"
	"pubit/internal/store"
)

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if !s.auth.CheckAdmin(req.Username, req.Password) {
		writeErr(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	s.auth.SetSession(w, req.Username)
	writeJSON(w, http.StatusOK, map[string]string{"user": req.Username})
}

func (s *Server) logout(w http.ResponseWriter, _ *http.Request) {
	s.auth.ClearSession(w)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	user := "agent"
	if u, ok := s.auth.SessionUser(r); ok {
		user = u
	}
	writeJSON(w, http.StatusOK, map[string]string{"user": user, "base_url": s.cfg.BaseURL})
}

func (s *Server) listSites(w http.ResponseWriter, _ *http.Request) {
	sites, err := s.store.List()
	if storeErr(w, err) {
		return
	}
	if sites == nil {
		sites = []store.Site{}
	}
	out := make([]map[string]any, 0, len(sites))
	for _, site := range sites {
		out = append(out, s.siteJSON(site))
	}
	writeJSON(w, http.StatusOK, map[string]any{"sites": out})
}

func (s *Server) createSite(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Slug        string `json:"slug"`
		Name        string `json:"name"`
		ShortCode   string `json:"short_code"`
		HTTPEnabled *bool  `json:"http_enabled"`
		Password    string `json:"password"`
		SPAFallback bool   `json:"spa_fallback"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	req.Slug = strings.ToLower(strings.TrimSpace(req.Slug))
	if !validSlug(req.Slug) {
		writeErr(w, http.StatusBadRequest, "invalid slug")
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = req.Slug
	}
	short := strings.TrimSpace(req.ShortCode)
	if short != "" && !validShort(short) {
		writeErr(w, http.StatusBadRequest, "invalid short_code")
		return
	}
	httpOn := true
	if req.HTTPEnabled != nil {
		httpOn = *req.HTTPEnabled
	}
	hash := ""
	if req.Password != "" {
		b, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		hash = string(b)
	}
	site, err := s.store.Create(store.Site{
		Slug:         req.Slug,
		Name:         name,
		ShortCode:    short,
		HTTPEnabled:  httpOn,
		PasswordHash: hash,
		SPAFallback:  req.SPAFallback,
	})
	if storeErr(w, err) {
		return
	}
	if err := os.MkdirAll(s.siteRoot(site.Slug), 0o755); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, s.siteJSON(site))
}

func (s *Server) getSite(w http.ResponseWriter, r *http.Request) {
	site, err := s.store.Get(r.PathValue("slug"))
	if storeErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, s.siteJSON(site))
}

func (s *Server) updateSite(w http.ResponseWriter, r *http.Request) {
	site, err := s.store.Get(r.PathValue("slug"))
	if storeErr(w, err) {
		return
	}
	var req struct {
		Name          *string `json:"name"`
		ShortCode     *string `json:"short_code"`
		HTTPEnabled   *bool   `json:"http_enabled"`
		Password      *string `json:"password"`
		ClearPassword bool    `json:"clear_password"`
		SPAFallback   *bool   `json:"spa_fallback"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			writeErr(w, http.StatusBadRequest, "invalid name")
			return
		}
		site.Name = name
	}
	if req.ShortCode != nil {
		code := strings.TrimSpace(*req.ShortCode)
		if code != "" && !validShort(code) {
			writeErr(w, http.StatusBadRequest, "invalid short_code")
			return
		}
		site.ShortCode = code
	}
	if req.HTTPEnabled != nil {
		site.HTTPEnabled = *req.HTTPEnabled
	}
	if req.SPAFallback != nil {
		site.SPAFallback = *req.SPAFallback
	}
	if req.ClearPassword {
		site.PasswordHash = ""
	} else if req.Password != nil && *req.Password != "" {
		b, err := bcrypt.GenerateFromPassword([]byte(*req.Password), bcrypt.DefaultCost)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		site.PasswordHash = string(b)
	}
	site, err = s.store.Update(site)
	if storeErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, s.siteJSON(site))
}

func (s *Server) deleteSite(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	if err := s.store.Delete(slug); storeErr(w, err) {
		return
	}
	_ = os.RemoveAll(s.siteRoot(slug))
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) treeFiles(w http.ResponseWriter, r *http.Request) {
	if _, err := s.store.Get(r.PathValue("slug")); storeErr(w, err) {
		return
	}
	root := s.siteRoot(r.PathValue("slug"))
	entries, err := files.Tree(root, "")
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if entries == nil {
		entries = []files.Entry{}
	}
	n, b, _ := files.Stats(root)
	writeJSON(w, http.StatusOK, map[string]any{"entries": entries, "file_count": n, "byte_size": b})
}

func (s *Server) listFiles(w http.ResponseWriter, r *http.Request) {
	if _, err := s.store.Get(r.PathValue("slug")); storeErr(w, err) {
		return
	}
	entries, err := files.List(s.siteRoot(r.PathValue("slug")), r.URL.Query().Get("path"))
	if err != nil {
		if os.IsNotExist(err) {
			writeErr(w, http.StatusNotFound, "not found")
			return
		}
		if err == files.ErrInvalidPath {
			writeErr(w, http.StatusBadRequest, "invalid path")
			return
		}
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"path": r.URL.Query().Get("path"), "entries": entries})
}

func (s *Server) putFile(w http.ResponseWriter, r *http.Request) {
	if _, err := s.store.Get(r.PathValue("slug")); storeErr(w, err) {
		return
	}
	var req struct {
		Path    string `json:"path"`
		Content string `json:"content"`
		Dir     bool   `json:"dir"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	root := s.siteRoot(r.PathValue("slug"))
	var err error
	if req.Dir {
		err = files.Mkdir(root, req.Path)
	} else {
		err = files.WriteFile(root, req.Path, []byte(req.Content))
	}
	if err == files.ErrInvalidPath {
		writeErr(w, http.StatusBadRequest, "invalid path")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) uploadFile(w http.ResponseWriter, r *http.Request) {
	if _, err := s.store.Get(r.PathValue("slug")); storeErr(w, err) {
		return
	}
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid multipart")
		return
	}
	fh, hdr, err := r.FormFile("file")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "file required")
		return
	}
	defer fh.Close()
	data, err := io.ReadAll(fh)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	dest := r.FormValue("path")
	if dest == "" || strings.HasSuffix(dest, "/") {
		dest = strings.TrimSuffix(dest, "/")
		if dest != "" {
			dest += "/"
		}
		dest += hdr.Filename
	}
	if err := files.WriteFile(s.siteRoot(r.PathValue("slug")), dest, data); err != nil {
		if err == files.ErrInvalidPath {
			writeErr(w, http.StatusBadRequest, "invalid path")
			return
		}
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "path": dest})
}

func (s *Server) deleteFile(w http.ResponseWriter, r *http.Request) {
	if _, err := s.store.Get(r.PathValue("slug")); storeErr(w, err) {
		return
	}
	if err := files.Remove(s.siteRoot(r.PathValue("slug")), r.URL.Query().Get("path")); err != nil {
		if err == files.ErrInvalidPath {
			writeErr(w, http.StatusBadRequest, "invalid path")
			return
		}
		if os.IsNotExist(err) {
			writeErr(w, http.StatusNotFound, "not found")
			return
		}
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) getContent(w http.ResponseWriter, r *http.Request) {
	if _, err := s.store.Get(r.PathValue("slug")); storeErr(w, err) {
		return
	}
	data, err := files.ReadFile(s.siteRoot(r.PathValue("slug")), r.URL.Query().Get("path"))
	if err == files.ErrInvalidPath {
		writeErr(w, http.StatusBadRequest, "invalid path")
		return
	}
	if os.IsNotExist(err) {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !files.IsText(data) {
		writeErr(w, http.StatusUnsupportedMediaType, "binary file")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"path": r.URL.Query().Get("path"), "content": string(data)})
}

func (s *Server) importZip(w http.ResponseWriter, r *http.Request) {
	if _, err := s.store.Get(r.PathValue("slug")); storeErr(w, err) {
		return
	}
	if err := r.ParseMultipartForm(64 << 20); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid multipart")
		return
	}
	fh, _, err := r.FormFile("file")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "file required")
		return
	}
	defer fh.Close()
	data, err := io.ReadAll(fh)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := files.ImportZip(s.siteRoot(r.PathValue("slug")), bytes.NewReader(data), int64(len(data))); err != nil {
		if err == files.ErrInvalidPath {
			writeErr(w, http.StatusBadRequest, "invalid path")
			return
		}
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) exportZip(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	if _, err := s.store.Get(slug); storeErr(w, err) {
		return
	}
	root := s.siteRoot(slug)
	if !exists(root) {
		if err := os.MkdirAll(root, 0o755); err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
	}
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", `attachment; filename="`+slug+`.zip"`)
	if err := files.ExportZip(root, w); err != nil {
		s.log.Error("export zip", "err", err)
	}
}

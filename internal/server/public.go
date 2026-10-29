package server

import (
	"html"
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
	rel := r.PathValue("path")
	if rel == "" && !strings.HasSuffix(r.URL.Path, "/") {
		http.Redirect(w, r, "/"+slug+"/", http.StatusFound)
		return
	}
	if site.PasswordHash != "" {
		if r.Method == http.MethodPost {
			_ = r.ParseForm()
			pass := r.FormValue("password")
			if bcrypt.CompareHashAndPassword([]byte(site.PasswordHash), []byte(pass)) == nil {
				s.auth.SetSiteSession(w, slug, site.PasswordHash)
				http.Redirect(w, r, r.URL.RequestURI(), http.StatusSeeOther)
				return
			}
			renderUnlock(w, site, true)
			return
		}
		if !s.siteUnlocked(r, site) {
			renderUnlock(w, site, false)
			return
		}
	}
	if r.Method == http.MethodPost {
		http.Redirect(w, r, r.URL.RequestURI(), http.StatusSeeOther)
		return
	}
	s.serveSite(w, r, site, rel)
}

func (s *Server) siteUnlocked(r *http.Request, site store.Site) bool {
	if s.auth.SiteSessionOK(r, site.Slug, site.PasswordHash) {
		return true
	}
	_, pass, ok := r.BasicAuth()
	return ok && bcrypt.CompareHashAndPassword([]byte(site.PasswordHash), []byte(pass)) == nil
}

func renderUnlock(w http.ResponseWriter, site store.Site, wrong bool) {
	title := html.EscapeString(site.Name)
	errBlock := ""
	if wrong {
		errBlock = `<p class="err">Wrong password</p>`
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusUnauthorized)
	_, _ = w.Write([]byte(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>` + title + `</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    color: #09090b;
    background-color: #ffffff;
    background-image:
      radial-gradient(ellipse 80% 50% at 50% -20%, #ececef, transparent),
      linear-gradient(rgba(228,228,231,.7) 1px, transparent 1px),
      linear-gradient(90deg, rgba(228,228,231,.7) 1px, transparent 1px);
    background-size: auto, 48px 48px, 48px 48px;
  }
  .card {
    width: 100%;
    max-width: 360px;
    background: #ffffff;
    border: 1px solid #e4e4e7;
    border-radius: 14px;
    padding: 24px;
    box-shadow: 0 10px 25px -8px rgba(0,0,0,.08);
  }
  .brand { display: inline-flex; align-items: center; gap: 10px; margin-bottom: 18px; font-weight: 600; font-size: 16px; letter-spacing: -0.02em; }
  h1 { margin: 0 0 6px; font-size: 18px; letter-spacing: -0.02em; }
  p { margin: 0 0 16px; font-size: 13px; color: #71717a; }
  input {
    width: 100%;
    height: 38px;
    padding: 0 12px;
    border: 1px solid #e4e4e7;
    border-radius: 8px;
    font-size: 14px;
    outline: none;
  }
  input:focus { border-color: #18181b; box-shadow: 0 0 0 1px #18181b; }
  button {
    margin-top: 12px;
    width: 100%;
    height: 38px;
    border: 0;
    border-radius: 8px;
    background: #18181b;
    color: #fafafa;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
  }
  button:hover { background: #27272a; }
  .err { margin: 10px 0 0; color: #dc2626; font-size: 13px; }
</style>
</head>
<body>
  <form class="card" method="post">
    <div class="brand">
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="#09090b" />
        <path fill="#ffffff" d="M8.2 16.1 23.6 8.7c.85-.4 1.7.45 1.3 1.3l-7.6 14.8c-.38.74-1.45.62-1.64-.18l-1.5-6.4-6.4-1.48c-.8-.19-.9-1.26-.16-1.64Z" />
      </svg>
      <span>Pubit</span>
    </div>
    <h1>` + title + `</h1>
    <p>Enter the password to open this site.</p>
    <input type="password" name="password" placeholder="Password" autofocus required />
    ` + errBlock + `
    <button type="submit">Continue</button>
  </form>
</body>
</html>`))
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

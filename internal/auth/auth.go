package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

const cookieName = "pubit_session"

type Auth struct {
	AdminUser  string
	AdminPass  string
	AgentToken string
	secret     []byte
}

type session struct {
	User string `json:"u"`
	Exp  int64  `json:"e"`
}

type siteSession struct {
	Slug string `json:"s"`
	Ver  string `json:"v"`
	Exp  int64  `json:"e"`
}

func New(adminUser, adminPass, agentToken string) *Auth {
	mac := hmac.New(sha256.New, []byte("pubit-session"))
	mac.Write([]byte(adminUser))
	mac.Write([]byte(adminPass))
	mac.Write([]byte(agentToken))
	return &Auth{
		AdminUser:  adminUser,
		AdminPass:  adminPass,
		AgentToken: agentToken,
		secret:     mac.Sum(nil),
	}
}

func (a *Auth) CheckAdmin(user, pass string) bool {
	return subtle.ConstantTimeCompare([]byte(user), []byte(a.AdminUser)) == 1 &&
		subtle.ConstantTimeCompare([]byte(pass), []byte(a.AdminPass)) == 1
}

func (a *Auth) CheckAgent(token string) bool {
	return subtle.ConstantTimeCompare([]byte(token), []byte(a.AgentToken)) == 1
}

func (a *Auth) CheckDAV(user, pass string) bool {
	return user == "agent" && a.CheckAgent(pass)
}

func (a *Auth) SetSession(w http.ResponseWriter, user string) {
	raw, _ := json.Marshal(session{User: user, Exp: time.Now().Add(7 * 24 * time.Hour).Unix()})
	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    a.sign(string(raw)),
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   7 * 24 * 3600,
	})
}

func (a *Auth) ClearSession(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	})
}

func (a *Auth) SessionUser(r *http.Request) (string, bool) {
	c, err := r.Cookie(cookieName)
	if err != nil || c.Value == "" {
		return "", false
	}
	raw, ok := a.verify(c.Value)
	if !ok {
		return "", false
	}
	var s session
	if json.Unmarshal([]byte(raw), &s) != nil {
		return "", false
	}
	if time.Now().Unix() > s.Exp || s.User == "" {
		return "", false
	}
	return s.User, true
}

func (a *Auth) RequestOK(r *http.Request) bool {
	if h := r.Header.Get("Authorization"); strings.HasPrefix(h, "Bearer ") {
		return a.CheckAgent(strings.TrimPrefix(h, "Bearer "))
	}
	_, ok := a.SessionUser(r)
	return ok
}

func (a *Auth) SetSiteSession(w http.ResponseWriter, slug, passHash string) {
	raw, _ := json.Marshal(siteSession{Slug: slug, Ver: passHash, Exp: time.Now().Add(7 * 24 * time.Hour).Unix()})
	http.SetCookie(w, &http.Cookie{
		Name:     "pubit_site_" + slug,
		Value:    a.sign(string(raw)),
		Path:     "/" + slug + "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   7 * 24 * 3600,
	})
}

func (a *Auth) SiteSessionOK(r *http.Request, slug, passHash string) bool {
	c, err := r.Cookie("pubit_site_" + slug)
	if err != nil || c.Value == "" {
		return false
	}
	raw, ok := a.verify(c.Value)
	if !ok {
		return false
	}
	var s siteSession
	if json.Unmarshal([]byte(raw), &s) != nil {
		return false
	}
	return time.Now().Unix() <= s.Exp && s.Slug == slug && s.Ver == passHash
}

func (a *Auth) sign(payload string) string {
	mac := hmac.New(sha256.New, a.secret)
	mac.Write([]byte(payload))
	return base64.RawURLEncoding.EncodeToString([]byte(payload)) + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func (a *Auth) verify(val string) (string, bool) {
	parts := strings.Split(val, ".")
	if len(parts) != 2 {
		return "", false
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return "", false
	}
	sig, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", false
	}
	mac := hmac.New(sha256.New, a.secret)
	mac.Write(payload)
	if !hmac.Equal(sig, mac.Sum(nil)) {
		return "", false
	}
	return string(payload), true
}

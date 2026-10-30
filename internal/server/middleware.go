package server

import (
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"path/filepath"
	"strings"
)

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

// withRepo only lets handlers touch repos returned by /api/repos, and only repo-relative paths.
func (s *Server) withRepo(h func(http.ResponseWriter, *http.Request, string)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		repo := r.URL.Query().Get("repo")
		s.mu.RLock()
		ok := s.allowed[repo]
		s.mu.RUnlock()
		if !ok {
			http.Error(w, "unknown repo", http.StatusForbidden)
			return
		}
		if p := r.URL.Query().Get("path"); p != "" && !filepath.IsLocal(p) {
			http.Error(w, "bad path", http.StatusBadRequest)
			return
		}
		h(w, r, repo)
	}
}

// root returns the folder a request browses: the command-line folder, or a ?root= inside --parent-dir.
func (s *Server) root(r *http.Request) (string, error) {
	root := r.URL.Query().Get("root")
	if root == "" || root == s.base {
		return s.base, nil
	}
	if s.parent == "" {
		return "", errors.New("start with --parent-dir to open other folders")
	}
	// resolve symlinks before the containment check so a link can't point outside parent
	real, err := filepath.EvalSymlinks(root)
	if err != nil {
		return "", err
	}
	if rel, err := filepath.Rel(s.parent, real); err != nil || rel != "." && !filepath.IsLocal(rel) {
		return "", errors.New("folder is outside --parent-dir")
	}
	return real, nil
}

// cacheStatic lets browsers keep built assets: /assets/ names are content-hashed (never change),
// /icons/ change only with a new release. embed.FS has no mod times, so without this every
// visit would re-download them.
func cacheStatic(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasPrefix(r.URL.Path, "/assets/"):
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		case strings.HasPrefix(r.URL.Path, "/icons/"):
			w.Header().Set("Cache-Control", "public, max-age=86400")
		}
		h.ServeHTTP(w, r)
	})
}

// hostGuard blocks DNS-rebinding when bound to loopback: only loopback Host headers are accepted.
func hostGuard(bind string, h http.Handler) http.Handler {
	if !isLoopback(bind) {
		return h
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hn, _, err := net.SplitHostPort(r.Host)
		if err != nil {
			hn = r.Host
		}
		if !isLoopback(hn) {
			http.Error(w, "forbidden host", http.StatusForbidden)
			return
		}
		h.ServeHTTP(w, r)
	})
}

func isLoopback(h string) bool {
	ip := net.ParseIP(h)
	return h == "localhost" || ip != nil && ip.IsLoopback()
}

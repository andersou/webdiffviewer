package middleware

import (
	"net/http"
	"strings"
)

// CacheStatic lets browsers keep built assets: /assets/ names are content-hashed (never change),
// /icons/ change only with a new release. embed.FS has no mod times, so without this every
// visit would re-download them.
func CacheStatic(h http.Handler) http.Handler {
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

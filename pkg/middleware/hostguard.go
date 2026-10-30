// Package middleware holds HTTP middleware shared by the API and static file server.
package middleware

import (
	"net"
	"net/http"
	"strings"
)

// HostGuard blocks DNS rebinding (a website pointing its own domain at this server so the
// visitor's browser reads it): the Host header must be an IP address, localhost, or one of
// allowed (--allowed-hosts, e.g. mac.local or a reverse-proxy domain). It applies however the
// server is bound, LAN addresses included.
func HostGuard(allowed []string, h http.Handler) http.Handler {
	ok := map[string]bool{"localhost": true}
	for _, a := range allowed {
		ok[strings.ToLower(a)] = true
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host, _, err := net.SplitHostPort(r.Host)
		if err != nil {
			host = r.Host
		}
		if !ok[strings.ToLower(host)] && net.ParseIP(host) == nil {
			http.Error(w, "forbidden host", http.StatusForbidden)
			return
		}
		h.ServeHTTP(w, r)
	})
}

// Package middleware holds HTTP middleware shared by the API and static file server.
package middleware

import (
	"net"
	"net/http"
)

// HostGuard blocks DNS-rebinding when bound to loopback: only loopback Host headers are accepted.
func HostGuard(bind string, h http.Handler) http.Handler {
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

// Package server is the HTTP API and static file server behind the web UI.
package server

import (
	"io/fs"
	"net/http"
	"sync"
)

type Server struct {
	base    string // folder given on the command line
	parent  string // --parent-dir: other folders the UI may open; "" disables the picker
	web     fs.FS  // built frontend (web/dist)
	mu      sync.RWMutex
	allowed map[string]bool // repo/worktree paths the API may touch, grown by /api/repos
}

// New serves base (and, if parent != "", any repo under parent) with the frontend in web.
func New(base, parent string, web fs.FS) *Server {
	return &Server{base: base, parent: parent, web: web, allowed: map[string]bool{}}
}

// Handler returns the routes, wrapped with the Host check for the address being bound.
func (s *Server) Handler(bindHost string) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/config", s.config)
	mux.HandleFunc("GET /api/folders", s.folders)
	mux.HandleFunc("GET /api/repos", s.repos)
	mux.HandleFunc("GET /api/branches", s.withRepo(s.branches))
	mux.HandleFunc("POST /api/checkout", s.withRepo(s.checkout))
	mux.HandleFunc("GET /api/files", s.withRepo(s.files))
	mux.HandleFunc("GET /api/status", s.withRepo(s.status))
	mux.HandleFunc("GET /api/diff", s.withRepo(s.diff))
	mux.HandleFunc("GET /api/file", s.withRepo(s.file))
	mux.HandleFunc("GET /api/raw", s.withRepo(s.raw))
	mux.HandleFunc("GET /api/log", s.withRepo(s.log))
	mux.HandleFunc("GET /api/commit", s.withRepo(s.commit))
	mux.Handle("/", cacheStatic(http.FileServerFS(s.web)))
	return hostGuard(bindHost, mux)
}

// Package api wires the HTTP endpoints, the static frontend and shared middleware.
package api

import (
	"io/fs"
	"net/http"

	"github.com/andersou/webdiffviewer/internal/api/handler/branches"
	"github.com/andersou/webdiffviewer/internal/api/handler/changes"
	"github.com/andersou/webdiffviewer/internal/api/handler/commits"
	"github.com/andersou/webdiffviewer/internal/api/handler/files"
	"github.com/andersou/webdiffviewer/internal/api/handler/workspace"
	"github.com/andersou/webdiffviewer/pkg/middleware"
	ws "github.com/andersou/webdiffviewer/services/workspace"
)

// New returns the full handler: /api routes, the frontend in web, and the Host check for bindHost.
func New(w *ws.Workspace, web fs.FS, bindHost string) http.Handler {
	mux := http.NewServeMux()
	workspace.Register(mux, w)
	branches.Register(mux, w)
	changes.Register(mux, w)
	files.Register(mux, w)
	commits.Register(mux, w)
	mux.Handle("/", middleware.CacheStatic(http.FileServerFS(web)))
	return middleware.HostGuard(bindHost, mux)
}

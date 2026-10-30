// Package commits serves the commit log and commit details.
package commits

import (
	"net/http"

	"github.com/andersou/webdiffviewer/services/workspace"
)

type Router struct{ ws *workspace.Workspace }

func Register(mux *http.ServeMux, ws *workspace.Workspace) {
	rt := &Router{ws: ws}
	mux.HandleFunc("GET /api/log", rt.getLog)
	mux.HandleFunc("GET /api/commit", rt.getCommit)
}

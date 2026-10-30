// Package changes serves working-tree status, branch comparisons and diffs.
package changes

import (
	"net/http"

	"github.com/andersou/webdiffviewer/services/workspace"
)

type Router struct{ ws *workspace.Workspace }

func Register(mux *http.ServeMux, ws *workspace.Workspace) {
	rt := &Router{ws: ws}
	mux.HandleFunc("GET /api/status", rt.getStatus)
	mux.HandleFunc("GET /api/diff", rt.getDiff)
}

// Package branches serves branch listing and switching.
package branches

import (
	"net/http"

	"github.com/andersou/webdiffviewer/services/workspace"
)

type Router struct{ ws *workspace.Workspace }

func Register(mux *http.ServeMux, ws *workspace.Workspace) {
	rt := &Router{ws: ws}
	mux.HandleFunc("GET /api/branches", rt.getBranches)
	mux.HandleFunc("POST /api/checkout", rt.postCheckout)
}

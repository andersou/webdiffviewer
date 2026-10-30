// Package workspace serves the folder/repo listing endpoints.
package workspace

import (
	"net/http"

	"github.com/andersou/webdiffviewer/services/workspace"
)

type Router struct{ ws *workspace.Workspace }

func Register(mux *http.ServeMux, ws *workspace.Workspace) {
	rt := &Router{ws: ws}
	mux.HandleFunc("GET /api/config", rt.getConfig)
	mux.HandleFunc("GET /api/folders", rt.getFolders)
	mux.HandleFunc("GET /api/repos", rt.getRepos)
}

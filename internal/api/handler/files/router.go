// Package files serves the file list, text file contents and raw files.
package files

import (
	"net/http"

	"github.com/andersou/webdiffviewer/services/workspace"
)

type Router struct{ ws *workspace.Workspace }

func Register(mux *http.ServeMux, ws *workspace.Workspace) {
	rt := &Router{ws: ws}
	mux.HandleFunc("GET /api/files", rt.getFiles)
	mux.HandleFunc("GET /api/file", rt.getFile)
	mux.HandleFunc("GET /api/raw", rt.getRaw)
}

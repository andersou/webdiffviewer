package helpers

import (
	"net/http"
	"path/filepath"

	"github.com/andersou/webdiffviewer/pkg/apperr"
	"github.com/andersou/webdiffviewer/services/workspace"
)

// Repo returns the ?repo= of r if the workspace allows it (it was listed by /api/repos),
// and rejects any ?path= that would leave the repo.
func Repo(ws *workspace.Workspace, r *http.Request) (string, error) {
	repo := r.URL.Query().Get("repo")
	if !ws.Allowed(repo) {
		return "", apperr.Forbidden("unknown repo")
	}
	if p := r.URL.Query().Get("path"); p != "" && !filepath.IsLocal(p) {
		return "", apperr.BadRequest("bad path")
	}
	return repo, nil
}

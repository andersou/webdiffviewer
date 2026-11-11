package helpers

import (
	"net/http"
	"path/filepath"
	"strings"

	"github.com/andersou/webdiffviewer/pkg/apperr"
	"github.com/andersou/webdiffviewer/services/workspace"
)

// Repo returns the ?repo= of r if the workspace allows it (it was listed by /api/repos),
// and rejects any ?path= that would leave the repo or reach into .git (remote URLs there
// can hold tokens).
func Repo(ws *workspace.Workspace, r *http.Request) (string, error) {
	repo := r.URL.Query().Get("repo")
	if !ws.Allowed(repo) {
		return "", apperr.Forbidden("unknown repo")
	}
	if p := r.URL.Query().Get("path"); p != "" && (!filepath.IsLocal(p) || inGitDir(p)) {
		return "", apperr.BadRequest("bad path")
	}
	return repo, nil
}

// inGitDir reports whether any segment of p is .git (any case: macOS and Windows ignore it),
// or a name Windows also opens it by (trailing dots/spaces, 8.3 GIT~1), as in git's is_ntfs_dotgit.
func inGitDir(p string) bool {
	for _, seg := range strings.Split(filepath.ToSlash(p), "/") {
		seg = strings.TrimRight(seg, ". ")
		if strings.EqualFold(seg, ".git") || strings.EqualFold(seg, "git~1") {
			return true
		}
	}
	return false
}

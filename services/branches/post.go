package branches

import (
	"strings"

	"github.com/andersou/webdiffviewer/internal/git"
	"github.com/andersou/webdiffviewer/pkg/apperr"
)

// Switch checks out branch. For a remote-only name ("feat" from "origin/feat"),
// git switch creates the local tracking branch.
func Switch(repo, branch string) ([]byte, error) {
	if branch == "" || strings.HasPrefix(branch, "-") {
		return nil, apperr.BadRequest("bad branch")
	}
	out, err := git.Run(repo, "switch", branch)
	if err != nil {
		return nil, apperr.Conflict(err)
	}
	return out, nil
}

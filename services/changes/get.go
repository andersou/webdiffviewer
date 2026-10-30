package changes

import (
	"errors"
	"os/exec"
	"path/filepath"

	"github.com/andersou/webdiffviewer/internal/git"
	"github.com/andersou/webdiffviewer/pkg/apperr"
)

// Status lists working-tree changes, or with base the changes since the merge-base with that
// branch (committed only, or including uncommitted and untracked files when withWorktree).
func Status(repo, base string, withWorktree bool) ([]git.Change, error) {
	if base == "" {
		return worktreeStatus(repo)
	}
	mb, err := mergeBase(repo, base)
	if err != nil {
		return nil, err
	}
	if !withWorktree {
		out, err := git.Run(repo, "diff", "--name-status", "-z", "-M", mb, "HEAD")
		if err != nil {
			return nil, err
		}
		return git.ParseNameStatus(string(out)), nil
	}
	out, err := git.Run(repo, "diff", "--name-status", "-z", "-M", mb)
	if err != nil {
		return nil, err
	}
	status, err := worktreeStatus(repo)
	if err != nil {
		return nil, err
	}
	return git.WithWorktree(git.ParseNameStatus(string(out)), status), nil
}

// Diff returns the unified diff selected by q.
func Diff(repo string, q DiffQuery) ([]byte, error) {
	if q.Path == "" || q.Orig != "" && !filepath.IsLocal(q.Orig) {
		return nil, apperr.BadRequest("bad path")
	}
	args, err := diffArgs(repo, q)
	if err != nil {
		return nil, err
	}
	out, err := git.Run(repo, args...)
	var ee *exec.ExitError
	if err != nil && !(q.Untracked && errors.As(err, &ee) && ee.ExitCode() == 1) { // --no-index exits 1 when files differ
		return nil, err
	}
	return out, nil
}

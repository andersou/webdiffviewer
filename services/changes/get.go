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
	if q.Untracked && q.HideIgnored && git.IsIgnored(repo, q.Path) { // --no-index would print any file, .env included
		return nil, apperr.NotFound("file not found")
	}
	args, err := diffArgs(repo, q)
	if err != nil {
		return nil, err
	}
	out, err := git.RunLimit(repo, MaxDiff, args...)
	if errors.Is(err, git.ErrTooLarge) {
		return nil, apperr.TooLarge("diff larger than 10MB")
	}
	var ee *exec.ExitError
	if err != nil && !(q.Untracked && errors.As(err, &ee) && ee.ExitCode() == 1) { // --no-index exits 1 when files differ
		return nil, err
	}
	return out, nil
}

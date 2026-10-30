package changes

import (
	"github.com/andersou/webdiffviewer/internal/git"
	"github.com/andersou/webdiffviewer/pkg/apperr"
)

func worktreeStatus(repo string) ([]git.Change, error) {
	out, err := git.Run(repo, "status", "--porcelain=v1", "-z", "-uall")
	if err != nil {
		return nil, err
	}
	return git.ParseStatus(string(out)), nil
}

// mergeBase is git.MergeBase with a client error for unknown or invalid branches.
func mergeBase(repo, base string) (string, error) {
	mb, err := git.MergeBase(repo, base)
	if err != nil {
		return "", apperr.BadRequest(err.Error())
	}
	return mb, nil
}

// diffArgs builds the git command for q (see DiffQuery for which source wins).
func diffArgs(repo string, q DiffQuery) ([]string, error) {
	paths := func() []string {
		if q.Orig != "" {
			return []string{q.Orig, q.Path}
		}
		return []string{q.Path}
	}
	diff := []string{"-c", "core.quotepath=off", "diff", "--no-color", "--no-ext-diff"}
	switch {
	case q.Commit != "":
		if !git.IsHash(q.Commit) {
			return nil, apperr.BadRequest("bad commit")
		}
		// one git call; merges diff against the first parent, root commits against nothing
		show := []string{"-c", "core.quotepath=off", "show", "--no-color", "--no-ext-diff", "--diff-merges=first-parent", "-M", "--format=", q.Commit, "--"}
		return append(show, paths()...), nil
	case q.Untracked: // before Base: untracked files have no history, even in a branch comparison
		// git special-cases /dev/null on every OS (os.DevNull is NUL on Windows)
		return append(diff, "--no-index", "--", "/dev/null", q.Path), nil
	case q.Base != "":
		mb, err := mergeBase(repo, q.Base)
		if err != nil {
			return nil, err
		}
		args := append(diff, "-M", mb)
		if !q.WithWorktree {
			args = append(args, "HEAD") // without the working tree: merge-base..HEAD
		}
		return append(append(args, "--"), paths()...), nil
	case q.Staged:
		return append(append(diff, "--cached", "-M", "--"), paths()...), nil
	default:
		return append(diff, "--", q.Path), nil
	}
}

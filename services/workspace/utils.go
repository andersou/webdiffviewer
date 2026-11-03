package workspace

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/andersou/webdiffviewer/internal/git"
)

// inside reports whether p is dir or below it.
func inside(dir, p string) bool {
	rel, err := filepath.Rel(dir, p)
	return err == nil && (rel == "." || filepath.IsLocal(rel))
}

// displayName is p relative to base, or its folder name when it is base itself or above it.
func displayName(base, p string) string {
	name, err := filepath.Rel(base, p)
	if err != nil || name == "." || strings.HasPrefix(name, "..") {
		return filepath.Base(p)
	}
	return name
}

// currentBranch is the checked-out branch, or the short commit id when detached.
func currentBranch(repo string) string {
	if b, err := git.Run(repo, "symbolic-ref", "-q", "--short", "HEAD"); err == nil {
		return strings.TrimSpace(string(b))
	}
	if b, err := git.Run(repo, "rev-parse", "--short", "HEAD"); err == nil {
		return strings.TrimSpace(string(b))
	}
	return ""
}

// worktrees lists repo's linked worktrees that are real checkouts (not repo itself).
func worktrees(repo string) []git.Worktree {
	out, _ := git.Run(repo, "worktree", "list", "--porcelain")
	var list []git.Worktree
	for _, wt := range git.ParseWorktrees(string(out)) {
		wt.Path = filepath.Clean(wt.Path) // same slash normalization as git.Discover
		// submodules list their gitdir (.git/modules/x) as main worktree; keep only real checkouts
		if _, err := os.Stat(filepath.Join(wt.Path, ".git")); wt.Path == repo || err != nil {
			continue
		}
		list = append(list, wt)
	}
	return list
}

// submoduleCheckouts finds p's checkouts inside the worktrees of the repo containing it: a
// superproject worktree clones its submodules separately, so `git worktree list` in p misses them.
func submoduleCheckouts(repos []Repo, p string) []git.Worktree {
	var list []git.Worktree
	for i := len(repos) - 1; i >= 0; i-- { // sorted paths: the last ancestor is the closest
		if !inside(repos[i].Path, p) {
			continue
		}
		rel, _ := filepath.Rel(repos[i].Path, p)
		for _, wt := range repos[i].Worktrees {
			c := filepath.Join(wt.Path, rel)
			if _, err := os.Lstat(filepath.Join(c, ".git")); err == nil {
				list = append(list, git.Worktree{Path: c, Branch: currentBranch(c)})
			}
		}
		break
	}
	return list
}

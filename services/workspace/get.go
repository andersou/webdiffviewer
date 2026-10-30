package workspace

import (
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/andersou/webdiffviewer/internal/git"
	"github.com/andersou/webdiffviewer/pkg/apperr"
)

// New serves base and, if parent != "", any repo under parent. Both must be real (symlink-free)
// paths. With checkIgnore, gitignored files are never served.
func New(base, parent string, checkIgnore bool) *Workspace {
	return &Workspace{base: base, parent: parent, checkIgnore: checkIgnore, allowed: map[string]bool{}}
}

// CheckIgnore reports whether gitignored files must be hidden (--check-ignore).
func (w *Workspace) CheckIgnore() bool { return w.checkIgnore }

func (w *Workspace) Config() Config { return Config{Base: w.base, Parent: w.parent} }

// Allowed reports whether repo was listed by Repos, so the API may touch it.
func (w *Workspace) Allowed(repo string) bool {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.allowed[repo]
}

// Root resolves the folder a request browses: base for "", otherwise a folder inside parent.
func (w *Workspace) Root(root string) (string, error) {
	if root == "" || root == w.base {
		return w.base, nil
	}
	if w.parent == "" {
		return "", apperr.Forbidden("start with --parent-dir to open other folders")
	}
	// resolve symlinks before the containment check so a link can't point outside parent
	real, err := filepath.EvalSymlinks(root)
	if err != nil {
		return "", apperr.Forbidden(err.Error())
	}
	if !inside(w.parent, real) {
		return "", apperr.Forbidden("folder is outside --parent-dir")
	}
	return real, nil
}

// Folders lists git repos under parent for the picker; it doesn't descend into repos.
func (w *Workspace) Folders() ([]Folder, error) {
	if w.parent == "" {
		return nil, apperr.NotFound("start with --parent-dir to open other folders")
	}
	list := []Folder{}
	filepath.WalkDir(w.parent, func(p string, d fs.DirEntry, err error) error {
		if err != nil || !d.IsDir() {
			return nil
		}
		rel, _ := filepath.Rel(w.parent, p)
		if p != w.parent && (strings.HasPrefix(d.Name(), ".") || d.Name() == "node_modules") {
			return fs.SkipDir
		}
		if _, err := os.Lstat(filepath.Join(p, ".git")); err == nil {
			name := rel
			if name == "." {
				name = filepath.Base(p)
			}
			list = append(list, Folder{Path: p, Name: name})
			if p != w.parent {
				return fs.SkipDir // nested repos/submodules show up once the repo is opened
			}
		}
		if strings.Count(rel, string(filepath.Separator)) >= 3 {
			return fs.SkipDir
		}
		return nil
	})
	return list, nil
}

// Repos lists the repos under root (see Root) with their branch and worktrees, and allows them.
func (w *Workspace) Repos(root string) ([]Repo, error) {
	base, err := w.Root(root)
	if err != nil {
		return nil, err
	}
	allowed := map[string]bool{}
	repos := []Repo{}
	for _, p := range git.Discover(base) {
		// a folder picked from --parent-dir may sit inside a repo above parent: don't expose that one
		if base != w.base && !inside(w.parent, p) {
			continue
		}
		repo := Repo{Path: p, Name: displayName(base, p), Branch: currentBranch(p), Worktrees: []git.Worktree{}}
		for _, wt := range worktrees(p) {
			repo.Worktrees = append(repo.Worktrees, wt)
			allowed[wt.Path] = true
		}
		allowed[p] = true
		repos = append(repos, repo)
	}
	w.mu.Lock()
	// additive: clients (tabs, people on the LAN) may browse different roots at the same time
	for p := range allowed {
		w.allowed[p] = true
	}
	w.mu.Unlock()
	return repos, nil
}

package server

import (
	"encoding/json"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/andersou/webdiffviewer/internal/git"
)

type Repo struct {
	Path      string         `json:"path"`
	Name      string         `json:"name"`
	Branch    string         `json:"branch"`
	Worktrees []git.Worktree `json:"worktrees"`
}

func (s *Server) config(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]any{"base": s.base, "parent": s.parent})
}

// folders lists git repos under --parent-dir for the picker; it doesn't descend into repos.
func (s *Server) folders(w http.ResponseWriter, r *http.Request) {
	if s.parent == "" {
		http.Error(w, "start with --parent-dir to open other folders", http.StatusNotFound)
		return
	}
	type folder struct {
		Path string `json:"path"`
		Name string `json:"name"`
	}
	list := []folder{}
	filepath.WalkDir(s.parent, func(p string, d fs.DirEntry, err error) error {
		if err != nil || !d.IsDir() {
			return nil
		}
		rel, _ := filepath.Rel(s.parent, p)
		if p != s.parent && (strings.HasPrefix(d.Name(), ".") || d.Name() == "node_modules") {
			return fs.SkipDir
		}
		if _, err := os.Lstat(filepath.Join(p, ".git")); err == nil {
			name := rel
			if name == "." {
				name = filepath.Base(p)
			}
			list = append(list, folder{Path: p, Name: name})
			if p != s.parent {
				return fs.SkipDir // nested repos/submodules show up once the repo is opened
			}
		}
		if strings.Count(rel, string(filepath.Separator)) >= 3 {
			return fs.SkipDir
		}
		return nil
	})
	writeJSON(w, list)
}

// repos lists the repos under the requested root and allows the API to touch them.
func (s *Server) repos(w http.ResponseWriter, r *http.Request) {
	base, err := s.root(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}
	allowed := map[string]bool{}
	repos := []Repo{}
	for _, p := range git.Discover(base) {
		// a folder picked from --parent-dir may sit inside a repo above parent: don't expose that one
		if rel, err := filepath.Rel(s.parent, p); base != s.base && (err != nil || rel != "." && !filepath.IsLocal(rel)) {
			continue
		}
		name, err := filepath.Rel(base, p)
		if err != nil || name == "." || strings.HasPrefix(name, "..") {
			name = filepath.Base(p)
		}
		repo := Repo{Path: p, Name: name, Worktrees: []git.Worktree{}}
		if b, err := git.Run(p, "symbolic-ref", "-q", "--short", "HEAD"); err == nil {
			repo.Branch = strings.TrimSpace(string(b))
		} else if b, err := git.Run(p, "rev-parse", "--short", "HEAD"); err == nil {
			repo.Branch = strings.TrimSpace(string(b)) // detached
		}
		out, _ := git.Run(p, "worktree", "list", "--porcelain")
		for _, wt := range git.ParseWorktrees(string(out)) {
			wt.Path = filepath.Clean(wt.Path) // same slash normalization as Discover
			// submodules list their gitdir (.git/modules/x) as main worktree; keep only real checkouts
			if _, err := os.Stat(filepath.Join(wt.Path, ".git")); wt.Path == p || err != nil {
				continue
			}
			repo.Worktrees = append(repo.Worktrees, wt)
			allowed[wt.Path] = true
		}
		allowed[p] = true
		repos = append(repos, repo)
	}
	s.mu.Lock()
	// additive: clients (tabs, people on the LAN) may browse different roots at the same time
	for p := range allowed {
		s.allowed[p] = true
	}
	s.mu.Unlock()
	writeJSON(w, repos)
}

func (s *Server) branches(w http.ResponseWriter, r *http.Request, repo string) {
	out, err := git.Run(repo, "for-each-ref", "--format=%(HEAD)%(refname)", "refs/heads", "refs/remotes")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	res := struct {
		Current string   `json:"current"`
		Local   []string `json:"local"`
		Remote  []string `json:"remote"`
	}{Local: []string{}, Remote: []string{}}
	for _, l := range strings.Split(strings.TrimRight(string(out), "\n"), "\n") { // keep the leading HEAD marker (' ' or '*')
		if len(l) < 2 || strings.HasSuffix(l, "/HEAD") {
			continue
		}
		if b, ok := strings.CutPrefix(l[1:], "refs/heads/"); ok {
			res.Local = append(res.Local, b)
			if l[0] == '*' {
				res.Current = b
			}
		} else {
			res.Remote = append(res.Remote, strings.TrimPrefix(l[1:], "refs/remotes/"))
		}
	}
	writeJSON(w, res)
}

func (s *Server) checkout(w http.ResponseWriter, r *http.Request, repo string) {
	// requiring JSON forces a CORS preflight, so other sites can't trigger checkouts
	if r.Header.Get("Content-Type") != "application/json" {
		http.Error(w, "expected application/json", http.StatusUnsupportedMediaType)
		return
	}
	var body struct{ Branch string }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Branch == "" || strings.HasPrefix(body.Branch, "-") {
		http.Error(w, "bad branch", http.StatusBadRequest)
		return
	}
	// remote names like origin/feat become "feat": git switch DWIM creates the tracking branch
	if out, err := git.Run(repo, "switch", body.Branch); err != nil {
		http.Error(w, err.Error(), http.StatusConflict)
	} else {
		w.Write(out)
	}
}

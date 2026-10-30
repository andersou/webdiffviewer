package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
)

type server struct {
	base    string // folder given on the command line
	parent  string // --parent-dir: other folders the UI may open; "" disables the picker
	mu      sync.RWMutex
	allowed map[string]bool // repo/worktree paths the API may touch, grown by /api/repos
}

type Worktree struct {
	Path   string `json:"path"`
	Branch string `json:"branch"`
	Head   string `json:"head"`
}

type Repo struct {
	Path      string     `json:"path"`
	Name      string     `json:"name"`
	Branch    string     `json:"branch"`
	Worktrees []Worktree `json:"worktrees"`
}

type Change struct {
	X    string `json:"x"` // index status
	Y    string `json:"y"` // worktree status
	Path string `json:"path"`
	Orig string `json:"orig,omitempty"`
	// Dirty marks entries of a branch comparison that also have uncommitted (staged, unstaged or untracked) changes
	Dirty bool `json:"dirty,omitempty"`
}

func git(dir string, args ...string) ([]byte, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	out, err := cmd.Output()
	if err != nil {
		return out, fmt.Errorf("git %s: %w: %s", strings.Join(args, " "), err, strings.TrimSpace(stderr.String()))
	}
	return out, nil
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func (s *server) withRepo(h func(http.ResponseWriter, *http.Request, string)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		repo := r.URL.Query().Get("repo")
		s.mu.RLock()
		ok := s.allowed[repo]
		s.mu.RUnlock()
		if !ok {
			http.Error(w, "unknown repo", http.StatusForbidden)
			return
		}
		if p := r.URL.Query().Get("path"); p != "" && !filepath.IsLocal(p) {
			http.Error(w, "bad path", http.StatusBadRequest)
			return
		}
		h(w, r, repo)
	}
}

// root returns the folder a request browses: the command-line folder, or a ?root= inside --parent-dir.
func (s *server) root(r *http.Request) (string, error) {
	root := r.URL.Query().Get("root")
	if root == "" || root == s.base {
		return s.base, nil
	}
	if s.parent == "" {
		return "", errors.New("start with --parent-dir to open other folders")
	}
	// resolve symlinks before the containment check so a link can't point outside parent
	real, err := filepath.EvalSymlinks(root)
	if err != nil {
		return "", err
	}
	if rel, err := filepath.Rel(s.parent, real); err != nil || rel != "." && !filepath.IsLocal(rel) {
		return "", errors.New("folder is outside --parent-dir")
	}
	return real, nil
}

func (s *server) config(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]any{"base": s.base, "parent": s.parent})
}

// folders lists git repos under --parent-dir for the picker; it doesn't descend into repos.
func (s *server) folders(w http.ResponseWriter, r *http.Request) {
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

// discover finds the repo containing base plus every git repo/submodule below it (like VS Code's repo scan).
func discover(base string) []string {
	seen := map[string]bool{}
	var paths []string
	add := func(p string) {
		p = filepath.Clean(p) // git prints C:/x on Windows; filepath uses C:\x
		if !seen[p] {
			seen[p] = true
			paths = append(paths, p)
		}
	}
	if top, err := git(base, "rev-parse", "--show-toplevel"); err == nil {
		add(strings.TrimSpace(string(top)))
	}
	filepath.WalkDir(base, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		name := d.Name()
		if name == ".git" {
			add(filepath.Dir(p))
			if d.IsDir() {
				return fs.SkipDir
			}
			return nil
		}
		if d.IsDir() && p != base {
			rel, _ := filepath.Rel(base, p)
			if strings.HasPrefix(name, ".") || name == "node_modules" || strings.Count(rel, string(filepath.Separator)) >= 6 {
				return fs.SkipDir
			}
		}
		return nil
	})
	sort.Strings(paths)
	return paths
}

func parseWorktrees(out string) []Worktree {
	var list []Worktree
	for _, block := range strings.Split(strings.TrimSpace(out), "\n\n") {
		var wt Worktree
		skip := false
		for _, l := range strings.Split(block, "\n") {
			k, v, _ := strings.Cut(l, " ")
			switch k {
			case "worktree":
				wt.Path = v
			case "HEAD":
				wt.Head = v[:min(7, len(v))]
			case "branch":
				wt.Branch = strings.TrimPrefix(v, "refs/heads/")
			case "bare", "prunable":
				skip = true // nothing to view
			}
		}
		if wt.Path != "" && !skip {
			list = append(list, wt)
		}
	}
	return list
}

func (s *server) repos(w http.ResponseWriter, r *http.Request) {
	base, err := s.root(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}
	allowed := map[string]bool{}
	repos := []Repo{}
	for _, p := range discover(base) {
		// a folder picked from --parent-dir may sit inside a repo above parent: don't expose that one
		if rel, err := filepath.Rel(s.parent, p); base != s.base && (err != nil || rel != "." && !filepath.IsLocal(rel)) {
			continue
		}
		name, err := filepath.Rel(base, p)
		if err != nil || name == "." || strings.HasPrefix(name, "..") {
			name = filepath.Base(p)
		}
		repo := Repo{Path: p, Name: name, Worktrees: []Worktree{}}
		if b, err := git(p, "symbolic-ref", "-q", "--short", "HEAD"); err == nil {
			repo.Branch = strings.TrimSpace(string(b))
		} else if b, err := git(p, "rev-parse", "--short", "HEAD"); err == nil {
			repo.Branch = strings.TrimSpace(string(b)) // detached
		}
		out, _ := git(p, "worktree", "list", "--porcelain")
		for _, wt := range parseWorktrees(string(out)) {
			wt.Path = filepath.Clean(wt.Path) // same slash normalization as discover
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

func (s *server) branches(w http.ResponseWriter, r *http.Request, repo string) {
	out, err := git(repo, "for-each-ref", "--format=%(HEAD)%(refname)", "refs/heads", "refs/remotes")
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

func (s *server) checkout(w http.ResponseWriter, r *http.Request, repo string) {
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
	if out, err := git(repo, "switch", body.Branch); err != nil {
		http.Error(w, err.Error(), http.StatusConflict)
	} else {
		w.Write(out)
	}
}

func (s *server) files(w http.ResponseWriter, r *http.Request, repo string) {
	out, err := git(repo, "ls-files", "-z", "--cached", "--others", "--exclude-standard")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	files := []string{}
	for _, f := range strings.Split(string(out), "\x00") {
		if f != "" && (len(files) == 0 || files[len(files)-1] != f) { // ls-files repeats unmerged paths
			files = append(files, f)
		}
	}
	writeJSON(w, files)
}

func parseStatus(out string) []Change {
	list := []Change{}
	parts := strings.Split(out, "\x00")
	for i := 0; i < len(parts); i++ {
		p := parts[i]
		if len(p) < 4 {
			continue
		}
		c := Change{X: p[:1], Y: p[1:2], Path: p[3:]}
		if strings.ContainsAny(p[:2], "RC") && i+1 < len(parts) {
			i++
			c.Orig = parts[i]
		}
		list = append(list, c)
	}
	return list
}

// parseNameStatus reads `git diff --name-status -z`: "M\0path\0" or "R100\0old\0new\0".
func parseNameStatus(out string) []Change {
	list := []Change{}
	parts := strings.Split(out, "\x00")
	for i := 0; i+1 < len(parts); i += 2 {
		c := Change{X: parts[i][:1], Y: " ", Path: parts[i+1]}
		if (c.X == "R" || c.X == "C") && i+2 < len(parts) {
			c.Orig, c.Path = parts[i+1], parts[i+2]
			i++
		}
		list = append(list, c)
	}
	return list
}

// withWorktree merges `git status` into a branch comparison: flags entries that have
// uncommitted edits and adds untracked files, which `git diff <base>` never lists.
func withWorktree(diff, status []Change) []Change {
	dirty := map[string]bool{}
	for _, c := range status {
		if c.X == "?" {
			diff = append(diff, Change{X: "?", Y: "?", Path: c.Path, Dirty: true})
		} else {
			dirty[c.Path] = true
		}
	}
	for i := range diff {
		if dirty[diff[i].Path] {
			diff[i].Dirty = true
		}
	}
	return diff
}

// mergeBase returns the fork point of HEAD and base, so the diff shows only this branch's changes (PR-style).
func mergeBase(repo, base string) (string, error) {
	if strings.HasPrefix(base, "-") {
		return "", errors.New("bad base")
	}
	out, err := git(repo, "merge-base", base, "HEAD")
	return strings.TrimSpace(string(out)), err
}

func (s *server) status(w http.ResponseWriter, r *http.Request, repo string) {
	if base := r.URL.Query().Get("base"); base != "" {
		mb, err := mergeBase(repo, base)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if r.URL.Query().Get("wt") != "1" { // committed branch changes only
			out, err := git(repo, "diff", "--name-status", "-z", "-M", mb, "HEAD")
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			writeJSON(w, parseNameStatus(string(out)))
			return
		}
		out, err := git(repo, "diff", "--name-status", "-z", "-M", mb)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		st, err := git(repo, "status", "--porcelain=v1", "-z", "-uall")
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, withWorktree(parseNameStatus(string(out)), parseStatus(string(st))))
		return
	}
	out, err := git(repo, "status", "--porcelain=v1", "-z", "-uall")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, parseStatus(string(out)))
}

func (s *server) diff(w http.ResponseWriter, r *http.Request, repo string) {
	q := r.URL.Query()
	path, orig := q.Get("path"), q.Get("orig")
	if path == "" || orig != "" && !filepath.IsLocal(orig) {
		http.Error(w, "bad path", http.StatusBadRequest)
		return
	}
	args := []string{"-c", "core.quotepath=off", "diff", "--no-color", "--no-ext-diff"}
	untracked := q.Get("untracked") == "1"
	switch base := q.Get("base"); {
	case untracked: // checked first: untracked files have no history, even in a branch comparison
		args = append(args, "--no-index", "--", "/dev/null", path) // git special-cases /dev/null on every OS (os.DevNull is NUL on Windows)
	case base != "":
		mb, err := mergeBase(repo, base)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		args = append(args, "-M", mb)
		if q.Get("wt") != "1" {
			args = append(args, "HEAD") // without the working tree: merge-base..HEAD
		}
		args = append(args, "--")
		if orig != "" {
			args = append(args, orig)
		}
		args = append(args, path)
	case q.Get("staged") == "1":
		args = append(args, "--cached", "-M", "--")
		if orig != "" {
			args = append(args, orig)
		}
		args = append(args, path)
	default:
		args = append(args, "--", path)
	}
	out, err := git(repo, args...)
	var ee *exec.ExitError
	if err != nil && !(untracked && errors.As(err, &ee) && ee.ExitCode() == 1) { // --no-index exits 1 when files differ
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Write(out)
}

const maxFile = 5 << 20

// file returns a text file: from the working tree, or with ?rev=HEAD / ?rev=: (index) the version git has stored.
func (s *server) file(w http.ResponseWriter, r *http.Request, repo string) {
	q := r.URL.Query()
	var buf []byte
	var err error
	switch rev := q.Get("rev"); rev {
	case "":
		// OpenInRoot refuses symlinks that escape the repo
		f, openErr := os.OpenInRoot(repo, q.Get("path"))
		if openErr != nil {
			http.Error(w, openErr.Error(), http.StatusNotFound)
			return
		}
		defer f.Close()
		buf, err = io.ReadAll(io.LimitReader(f, maxFile+1))
	case "HEAD", ":":
		sep := ":"
		if rev == ":" {
			sep = ""
		}
		if buf, err = git(repo, "show", rev+sep+q.Get("path")); err != nil {
			http.Error(w, "not in "+map[string]string{"HEAD": "HEAD", ":": "the index"}[rev], http.StatusNotFound)
			return
		}
	default:
		http.Error(w, "rev must be HEAD or :", http.StatusBadRequest)
		return
	}
	switch {
	case err != nil:
		http.Error(w, "cannot read (directory or submodule?)", http.StatusBadRequest)
	case len(buf) > maxFile:
		http.Error(w, "file larger than 5MB", http.StatusRequestEntityTooLarge)
	case bytes.IndexByte(buf[:min(8000, len(buf))], 0) >= 0:
		http.Error(w, "binary file", http.StatusUnsupportedMediaType)
	default:
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Write(buf)
	}
}

// raw serves repo files as-is (images referenced by markdown previews).
func (s *server) raw(w http.ResponseWriter, r *http.Request, repo string) {
	f, err := os.OpenInRoot(repo, r.URL.Query().Get("path"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil || st.IsDir() {
		http.Error(w, "not a file", http.StatusBadRequest)
		return
	}
	// repo HTML/SVG opened directly must not run scripts with this origin's API access
	w.Header().Set("Content-Security-Policy", "sandbox")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeContent(w, r, st.Name(), st.ModTime(), f)
}

package server

import (
	"bytes"
	"errors"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/andersou/webdiffviewer/internal/git"
)

const maxFile = 5 << 20

func (s *Server) files(w http.ResponseWriter, r *http.Request, repo string) {
	out, err := git.Run(repo, "ls-files", "-z", "--cached", "--others", "--exclude-standard")
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

// status lists working-tree changes, or with ?base= the changes since the merge-base with that branch.
func (s *Server) status(w http.ResponseWriter, r *http.Request, repo string) {
	if base := r.URL.Query().Get("base"); base != "" {
		mb, err := git.MergeBase(repo, base)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if r.URL.Query().Get("wt") != "1" { // committed branch changes only
			out, err := git.Run(repo, "diff", "--name-status", "-z", "-M", mb, "HEAD")
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			writeJSON(w, git.ParseNameStatus(string(out)))
			return
		}
		out, err := git.Run(repo, "diff", "--name-status", "-z", "-M", mb)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		st, err := git.Run(repo, "status", "--porcelain=v1", "-z", "-uall")
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, git.WithWorktree(git.ParseNameStatus(string(out)), git.ParseStatus(string(st))))
		return
	}
	out, err := git.Run(repo, "status", "--porcelain=v1", "-z", "-uall")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, git.ParseStatus(string(out)))
}

// diff returns a unified diff for one file: working tree, staged, untracked, vs a base branch, or in a commit.
func (s *Server) diff(w http.ResponseWriter, r *http.Request, repo string) {
	q := r.URL.Query()
	path, orig := q.Get("path"), q.Get("orig")
	if path == "" || orig != "" && !filepath.IsLocal(orig) {
		http.Error(w, "bad path", http.StatusBadRequest)
		return
	}
	args := []string{"-c", "core.quotepath=off", "diff", "--no-color", "--no-ext-diff"}
	untracked := q.Get("untracked") == "1"
	switch base, commit := q.Get("base"), q.Get("commit"); {
	case commit != "":
		if !git.IsHash(commit) {
			http.Error(w, "bad commit", http.StatusBadRequest)
			return
		}
		// one git call; merges diff against the first parent, root commits against nothing
		args = []string{"-c", "core.quotepath=off", "show", "--no-color", "--no-ext-diff", "--diff-merges=first-parent", "-M", "--format=", commit, "--"}
		if orig != "" {
			args = append(args, orig)
		}
		args = append(args, path)
	case untracked: // checked first: untracked files have no history, even in a branch comparison
		args = append(args, "--no-index", "--", "/dev/null", path) // git special-cases /dev/null on every OS (os.DevNull is NUL on Windows)
	case base != "":
		mb, err := git.MergeBase(repo, base)
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
	out, err := git.Run(repo, args...)
	var ee *exec.ExitError
	if err != nil && !(untracked && errors.As(err, &ee) && ee.ExitCode() == 1) { // --no-index exits 1 when files differ
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Write(out)
}

// file returns a text file: from the working tree, or with ?rev=HEAD / ?rev=: (index) / ?rev=<hash> the version git has stored.
func (s *Server) file(w http.ResponseWriter, r *http.Request, repo string) {
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
	default:
		if rev != "HEAD" && rev != ":" && !git.IsHash(rev) {
			http.Error(w, "rev must be HEAD, : or a commit hash", http.StatusBadRequest)
			return
		}
		sep := ":"
		if rev == ":" {
			sep = ""
		}
		if buf, err = git.Run(repo, "show", rev+sep+q.Get("path")); err != nil {
			http.Error(w, "file not in "+rev, http.StatusNotFound)
			return
		}
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
func (s *Server) raw(w http.ResponseWriter, r *http.Request, repo string) {
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

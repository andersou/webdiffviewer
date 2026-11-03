package files

import (
	"bytes"
	"io/fs"
	"os"
	"strings"

	"github.com/andersou/webdiffviewer/internal/git"
	"github.com/andersou/webdiffviewer/pkg/apperr"
)

// List returns tracked and untracked (not ignored) files, or with ref the files of that branch.
func List(repo, ref string) ([]string, error) {
	args := []string{"ls-files", "-z", "--cached", "--others", "--exclude-standard"}
	if ref != "" {
		h, err := git.ResolveRef(repo, ref)
		if err != nil {
			return nil, apperr.BadRequest(err.Error())
		}
		args = []string{"ls-tree", "-r", "-z", "--name-only", "--full-tree", h}
	}
	out, err := git.Run(repo, args...)
	if err != nil {
		return nil, err
	}
	files := []string{}
	for _, f := range strings.Split(string(out), "\x00") {
		if f != "" && (len(files) == 0 || files[len(files)-1] != f) { // ls-files repeats unmerged paths
			files = append(files, f)
		}
	}
	return files, nil
}

// Read returns a text file from the working tree (rev ""), or the version git stores at
// rev "HEAD", ":" (the index), a commit hash or a branch. With hideIgnored, gitignored files are refused.
func Read(repo, path, rev string, hideIgnored bool) ([]byte, error) {
	buf, err := read(repo, path, rev, hideIgnored)
	if err != nil {
		return nil, err
	}
	switch {
	case len(buf) > MaxSize:
		return nil, apperr.TooLarge("file larger than 5MB")
	case bytes.IndexByte(buf[:min(8000, len(buf))], 0) >= 0:
		return nil, apperr.Unsupported("binary file")
	}
	return buf, nil
}

// Blob returns a file as git stores it at rev (raw files of a branch viewed without checkout).
func Blob(repo, path, rev string) ([]byte, error) {
	if rev == "" {
		return nil, apperr.BadRequest("rev required")
	}
	return read(repo, path, rev, false)
}

// Open opens a working-tree file for serving as-is. Symlinks that leave the repo are refused,
// and with hideIgnored so are gitignored files (where secrets like .env live).
func Open(repo, path string, hideIgnored bool) (*os.File, fs.FileInfo, error) {
	if hideIgnored && git.IsIgnored(repo, path) {
		return nil, nil, apperr.NotFound("file not found")
	}
	f, err := os.OpenInRoot(repo, path)
	if err != nil {
		return nil, nil, apperr.NotFound(err.Error())
	}
	st, err := f.Stat()
	if err != nil || st.IsDir() {
		f.Close()
		return nil, nil, apperr.BadRequest("not a file")
	}
	return f, st, nil
}

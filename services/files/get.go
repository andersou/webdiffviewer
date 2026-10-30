package files

import (
	"bytes"
	"io/fs"
	"os"
	"strings"

	"github.com/andersou/webdiffviewer/internal/git"
	"github.com/andersou/webdiffviewer/pkg/apperr"
)

// List returns tracked and untracked (not ignored) files.
func List(repo string) ([]string, error) {
	out, err := git.Run(repo, "ls-files", "-z", "--cached", "--others", "--exclude-standard")
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
// rev "HEAD", ":" (the index) or a commit hash.
func Read(repo, path, rev string) ([]byte, error) {
	buf, err := read(repo, path, rev)
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

// Open opens a working-tree file for serving as-is. Symlinks that leave the repo are refused.
func Open(repo, path string) (*os.File, fs.FileInfo, error) {
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

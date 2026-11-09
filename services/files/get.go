package files

import (
	"bytes"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"slices"
	"strings"

	"github.com/andersou/webdiffviewer/internal/git"
	"github.com/andersou/webdiffviewer/pkg/apperr"
)

// List returns tracked and untracked (not ignored) files, or with ref the files of that branch.
// With withIgnored (and no ref), gitignored files are listed apart, except hidden ones and those
// named in skip.
func List(repo, ref string, withIgnored bool, skip []string) (Files, error) {
	args := []string{"ls-files", "-z", "--cached", "--others", "--exclude-standard"}
	if ref != "" {
		h, err := git.ResolveRef(repo, ref)
		if err != nil {
			return Files{}, apperr.BadRequest(err.Error())
		}
		args = []string{"ls-tree", "-r", "-z", "--name-only", "--full-tree", h}
	}
	out, err := git.Run(repo, args...)
	if err != nil {
		return Files{}, err
	}
	res := Files{Files: []string{}, Ignored: []string{}}
	for _, f := range strings.Split(string(out), "\x00") {
		if f != "" && (len(res.Files) == 0 || res.Files[len(res.Files)-1] != f) { // ls-files repeats unmerged paths
			res.Files = append(res.Files, f)
		}
	}
	if withIgnored && ref == "" {
		res.Ignored, err = ignored(repo, skip)
	}
	return res, err
}

// maxIgnored caps the ignored list.
// shortcut: a huge build folder is cut at this many files, list folders lazily if that bites.
const maxIgnored = 20000

// ignored lists gitignored files. --directory makes git stop at wholly ignored folders, which are
// walked here so hidden folders, nested repos and the skip names are left out without reading them.
func ignored(repo string, names []string) ([]string, error) {
	out, err := git.Run(repo, "ls-files", "-z", "--others", "--ignored", "--exclude-standard", "--directory")
	if err != nil {
		return nil, err
	}
	list := []string{}
	skip := func(name string) bool { return strings.HasPrefix(name, ".") || slices.Contains(names, name) }
	for _, e := range strings.Split(string(out), "\x00") {
		dir := strings.HasSuffix(e, "/")
		e = strings.TrimSuffix(e, "/")
		if e == "" || skip(path.Base(e)) || len(list) >= maxIgnored {
			continue
		}
		if !dir {
			list = append(list, e)
			continue
		}
		filepath.WalkDir(filepath.Join(repo, e), func(p string, d fs.DirEntry, err error) error {
			if err != nil || len(list) >= maxIgnored {
				return filepath.SkipDir
			}
			if d.IsDir() {
				if _, err := os.Lstat(filepath.Join(p, ".git")); err == nil || skip(d.Name()) {
					return filepath.SkipDir
				}
				return nil
			}
			if !skip(d.Name()) {
				rel, _ := filepath.Rel(repo, p)
				list = append(list, filepath.ToSlash(rel))
			}
			return nil
		})
	}
	return list, nil
}

// ParseSkip turns the --skip-path value "node_modules, .venv" into names. Each must be a single
// folder or file name: the Explorer compares them with every path segment, not with whole paths.
func ParseSkip(s string) ([]string, error) {
	names := []string{}
	for _, n := range strings.Split(s, ",") {
		switch n = strings.TrimSpace(n); {
		case n == "":
		case n == "." || n == ".." || strings.ContainsAny(n, `/\`):
			return nil, fmt.Errorf("--skip-path: %q is not a folder or file name", n)
		default:
			names = append(names, n)
		}
	}
	return names, nil
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

// Blame returns each line of path with the commit that last changed it: in the working tree
// (rev "" or ":", whose staged state git blame can't read), or at HEAD, a commit or a branch.
func Blame(repo, path, rev string, hideIgnored bool) (BlameResult, error) {
	args := []string{"-c", "core.quotepath=off", "blame", "--porcelain"}
	switch {
	case rev == "" || rev == ":":
		if hideIgnored && git.IsIgnored(repo, path) {
			return BlameResult{}, apperr.NotFound("file not found")
		}
	case rev == "HEAD" || git.IsHash(rev):
		args = append(args, rev)
	default:
		h, err := git.ResolveRef(repo, rev)
		if err != nil {
			return BlameResult{}, apperr.BadRequest(err.Error())
		}
		args = append(args, h)
	}
	// porcelain repeats each line plus a header, so allow a few times the file size limit
	out, err := git.RunLimit(repo, 4*MaxSize, append(args, "--", path)...)
	if errors.Is(err, git.ErrTooLarge) {
		return BlameResult{}, apperr.TooLarge("file too large to blame")
	}
	if err != nil {
		return BlameResult{}, apperr.NotFound("cannot blame " + path + " (not committed?)")
	}
	return parseBlame(string(out)), nil
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

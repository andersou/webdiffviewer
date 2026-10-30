package files

import (
	"errors"
	"io"
	"os"

	"github.com/andersou/webdiffviewer/internal/git"
	"github.com/andersou/webdiffviewer/pkg/apperr"
)

// read loads up to MaxSize+1 bytes, so Read can tell a too-large file apart.
func read(repo, path, rev string, hideIgnored bool) ([]byte, error) {
	if rev == "" {
		if hideIgnored && git.IsIgnored(repo, path) { // --check-ignore: gitignored files (.env…) stay hidden
			return nil, apperr.NotFound("file not found")
		}
		f, err := os.OpenInRoot(repo, path) // refuses symlinks that escape the repo
		if err != nil {
			return nil, apperr.NotFound(err.Error())
		}
		defer f.Close()
		buf, err := io.ReadAll(io.LimitReader(f, MaxSize+1))
		if err != nil {
			return nil, apperr.BadRequest("cannot read (directory or submodule?)")
		}
		return buf, nil
	}
	if rev != "HEAD" && rev != ":" && !git.IsHash(rev) {
		return nil, apperr.BadRequest("rev must be HEAD, : or a commit hash")
	}
	sep := ":"
	if rev == ":" {
		sep = ""
	}
	buf, err := git.RunLimit(repo, MaxSize, "show", rev+sep+path)
	if errors.Is(err, git.ErrTooLarge) {
		return nil, apperr.TooLarge("file larger than 5MB")
	}
	if err != nil {
		return nil, apperr.NotFound("file not in " + rev)
	}
	return buf, nil
}

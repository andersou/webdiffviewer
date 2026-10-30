package files

import (
	"io"
	"os"

	"github.com/andersou/webdiffviewer/internal/git"
	"github.com/andersou/webdiffviewer/pkg/apperr"
)

// read loads up to MaxSize+1 bytes, so Read can tell a too-large file apart.
func read(repo, path, rev string) ([]byte, error) {
	if rev == "" {
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
	buf, err := git.Run(repo, "show", rev+sep+path)
	if err != nil {
		return nil, apperr.NotFound("file not in " + rev)
	}
	return buf, nil
}

package files

import (
	"errors"
	"io"
	"os"
	"strconv"
	"strings"

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
		h, err := git.ResolveRef(repo, rev) // a branch: read the commit it points to
		if err != nil {
			return nil, apperr.BadRequest(err.Error())
		}
		rev = h
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

// notCommitted is the id git blame gives lines that only exist in the working tree.
const notCommitted = "0000000000000000000000000000000000000000"

// parseBlame reads `git blame --porcelain`: per line a "<sha> <orig> <final> [<count>]" header,
// the commit's fields the first time that commit appears, then the line itself after a tab.
func parseBlame(out string) BlameResult {
	b := BlameResult{Commits: map[string]BlameCommit{}, Lines: []BlameLine{}}
	cur := ""
	for _, l := range strings.Split(out, "\n") {
		if text, ok := strings.CutPrefix(l, "\t"); ok {
			sha := cur
			if sha == notCommitted {
				sha = ""
			}
			b.Lines = append(b.Lines, BlameLine{Commit: sha, Text: text})
			continue
		}
		k, v, _ := strings.Cut(l, " ")
		if len(k) == 40 && git.IsHash(k) {
			cur = k
			continue
		}
		if cur == notCommitted {
			continue
		}
		c := b.Commits[cur]
		switch k {
		case "author":
			c.Author = v
		case "author-time":
			c.Time, _ = strconv.ParseInt(v, 10, 64)
		case "summary":
			c.Summary = v
		case "filename":
			c.Path = v
		default:
			continue
		}
		b.Commits[cur] = c
	}
	return b
}

package search

import (
	"errors"
	"os/exec"
	"strconv"
	"strings"

	"github.com/andersou/webdiffviewer/internal/git"
	"github.com/andersou/webdiffviewer/pkg/apperr"
)

// Run searches tracked text files of the working tree (submodules included, with paths relative
// to repo) or, with q.Ref, of that branch (submodules left out: their files can't be read from it).
func Run(repo string, q Query) (Result, error) {
	res := Result{Files: []File{}}
	if strings.TrimSpace(q.Text) == "" {
		return res, nil
	}
	args := []string{"-c", "core.quotepath=off", "grep", "-n", "-I", "--null", "--no-color", "--max-count", strconv.Itoa(maxPerFile)}
	if !q.Case {
		args = append(args, "-i")
	}
	if q.Word {
		args = append(args, "-w")
	}
	if q.Regex {
		args = append(args, "-E")
	} else {
		args = append(args, "-F")
	}
	args = append(args, "-e", q.Text) // -e: a text starting with "-" is a pattern, not an option
	prefix := ""
	if q.Ref != "" {
		h, err := git.ResolveRef(repo, q.Ref)
		if err != nil {
			return res, apperr.BadRequest(err.Error())
		}
		args = append(args, h)
		prefix = h + ":" // grep on a tree prints "<tree>:path"
	} else {
		args = append(args, "--recurse-submodules")
	}
	out, err := git.RunLimit(repo, MaxOutput, append(args, "--")...)
	var ee *exec.ExitError
	switch {
	case errors.Is(err, git.ErrTooLarge):
		res.Truncated = true // out holds what fit
	case errors.As(err, &ee) && ee.ExitCode() == 1: // no matches
		return res, nil
	case err != nil:
		return res, apperr.BadRequest(strings.TrimSpace(err.Error())) // e.g. an invalid regex
	}
	res.Files = parse(string(out), prefix, res.Truncated)
	return res, nil
}

// parse reads `git grep -n --null` lines ("path\0line\0text"); with cut, the last line may be partial.
func parse(out, prefix string, cut bool) []File {
	files := []File{}
	lines := strings.Split(strings.TrimSuffix(out, "\n"), "\n")
	if cut && len(lines) > 0 {
		lines = lines[:len(lines)-1]
	}
	for _, l := range lines {
		parts := strings.SplitN(l, "\x00", 3)
		if len(parts) != 3 {
			continue
		}
		n, err := strconv.Atoi(parts[1])
		if err != nil {
			continue
		}
		path := strings.TrimPrefix(parts[0], prefix)
		text := parts[2]
		if len(text) > maxLine {
			text = strings.ToValidUTF8(text[:maxLine], "") + "…"
		}
		if len(files) == 0 || files[len(files)-1].Path != path {
			files = append(files, File{Path: path})
		}
		f := &files[len(files)-1]
		f.Lines = append(f.Lines, Line{N: n, Text: text})
	}
	return files
}

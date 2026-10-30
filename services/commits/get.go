// Package commits lists history and reads one commit's details for the Commits tab.
package commits

import (
	"fmt"
	"strings"

	"github.com/andersou/webdiffviewer/internal/git"
	"github.com/andersou/webdiffviewer/pkg/apperr"
)

const pageSize = 300

// Log lists HEAD's history, or every branch/tag with all, pageSize commits after skip.
// Bodies and emails are left out; Details has them.
func Log(repo string, skip int, all bool) ([]git.Commit, error) {
	args := []string{"log", "--topo-order", "-n", fmt.Sprint(pageSize), "--skip", fmt.Sprint(max(skip, 0)), "--format=" + git.LogFormat}
	if all {
		args = append(args, "--branches", "--remotes", "--tags")
	}
	out, err := git.Run(repo, append(args, "HEAD", "--")...)
	if err != nil && !strings.Contains(err.Error(), "does not have any commits") {
		return nil, err
	}
	list := git.ParseLog(string(out))
	for i := range list {
		list[i].Body, list[i].Email = "", ""
	}
	return list, nil
}

// Details returns one commit and the files it changed (merges: against the first parent)
// in a single git call, so opening a commit costs one process.
func Details(repo, hash string) (git.Commit, []git.Change, error) {
	if !git.IsHash(hash) {
		return git.Commit{}, nil, apperr.BadRequest("bad commit")
	}
	out, err := git.Run(repo, "show", "--diff-merges=first-parent", "--name-status", "-z", "-M", "--format="+git.LogFormat, hash)
	if err != nil {
		return git.Commit{}, nil, apperr.NotFound("unknown commit")
	}
	c, files, ok := git.ParseShow(string(out))
	if !ok {
		return git.Commit{}, nil, apperr.NotFound("unknown commit")
	}
	return c, files, nil
}

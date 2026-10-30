package server

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/andersou/webdiffviewer/internal/git"
)

// log lists commits for the Commits tab: HEAD's history, or every branch/tag with ?all=1.
func (s *Server) log(w http.ResponseWriter, r *http.Request, repo string) {
	q := r.URL.Query()
	var skip int
	fmt.Sscan(q.Get("skip"), &skip)
	args := []string{"log", "--topo-order", "-n", "300", "--skip", fmt.Sprint(max(skip, 0)), "--format=" + git.LogFormat}
	if q.Get("all") == "1" {
		args = append(args, "--branches", "--remotes", "--tags")
	}
	args = append(args, "HEAD", "--")
	out, err := git.Run(repo, args...)
	if err != nil && !strings.Contains(err.Error(), "does not have any commits") {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	list := git.ParseLog(string(out))
	for i := range list {
		list[i].Body, list[i].Email = "", "" // details come from /api/commit
	}
	writeJSON(w, list)
}

// commit returns one commit's details and the files it changed (merges: against the first parent)
// in a single git call, so opening a commit costs one process.
func (s *Server) commit(w http.ResponseWriter, r *http.Request, repo string) {
	hash := r.URL.Query().Get("hash")
	if !git.IsHash(hash) {
		http.Error(w, "bad commit", http.StatusBadRequest)
		return
	}
	out, err := git.Run(repo, "show", "--diff-merges=first-parent", "--name-status", "-z", "-M", "--format="+git.LogFormat, hash)
	if err != nil {
		http.Error(w, "unknown commit", http.StatusNotFound)
		return
	}
	c, files, ok := git.ParseShow(string(out))
	if !ok {
		http.Error(w, "unknown commit", http.StatusNotFound)
		return
	}
	writeJSON(w, map[string]any{"commit": c, "files": files})
}

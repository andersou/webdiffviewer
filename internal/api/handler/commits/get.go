package commits

import (
	"fmt"
	"net/http"

	"github.com/andersou/webdiffviewer/internal/api/helpers"
	"github.com/andersou/webdiffviewer/services/commits"
)

func (rt *Router) getLog(w http.ResponseWriter, r *http.Request) {
	repo, err := helpers.Repo(rt.ws, r)
	if err != nil {
		helpers.Fail(w, err)
		return
	}
	var skip int
	fmt.Sscan(r.URL.Query().Get("skip"), &skip)
	list, err := commits.Log(repo, skip, r.URL.Query().Get("all") == "1")
	if err != nil {
		helpers.Fail(w, err)
		return
	}
	helpers.JSON(w, list)
}

func (rt *Router) getCommit(w http.ResponseWriter, r *http.Request) {
	repo, err := helpers.Repo(rt.ws, r)
	if err != nil {
		helpers.Fail(w, err)
		return
	}
	c, files, err := commits.Details(repo, r.URL.Query().Get("hash"))
	if err != nil {
		helpers.Fail(w, err)
		return
	}
	helpers.JSON(w, commitResponse{Commit: c, Files: files})
}

package branches

import (
	"net/http"

	"github.com/andersou/webdiffviewer/internal/api/helpers"
	"github.com/andersou/webdiffviewer/services/branches"
)

func (rt *Router) getBranches(w http.ResponseWriter, r *http.Request) {
	repo, err := helpers.Repo(rt.ws, r)
	if err != nil {
		helpers.Fail(w, err)
		return
	}
	list, err := branches.List(repo)
	if err != nil {
		helpers.Fail(w, err)
		return
	}
	helpers.JSON(w, list)
}

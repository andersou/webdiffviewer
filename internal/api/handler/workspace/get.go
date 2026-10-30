package workspace

import (
	"net/http"

	"github.com/andersou/webdiffviewer/internal/api/helpers"
)

func (rt *Router) getConfig(w http.ResponseWriter, r *http.Request) {
	helpers.JSON(w, rt.ws.Config())
}

func (rt *Router) getFolders(w http.ResponseWriter, r *http.Request) {
	list, err := rt.ws.Folders()
	if err != nil {
		helpers.Fail(w, err)
		return
	}
	helpers.JSON(w, list)
}

func (rt *Router) getRepos(w http.ResponseWriter, r *http.Request) {
	repos, err := rt.ws.Repos(r.URL.Query().Get("root"))
	if err != nil {
		helpers.Fail(w, err)
		return
	}
	helpers.JSON(w, repos)
}

package search

import (
	"net/http"

	"github.com/andersou/webdiffviewer/internal/api/helpers"
	"github.com/andersou/webdiffviewer/services/search"
)

func (rt *Router) getSearch(w http.ResponseWriter, r *http.Request) {
	repo, err := helpers.Repo(rt.ws, r)
	if err != nil {
		helpers.Fail(w, err)
		return
	}
	q := r.URL.Query()
	res, err := search.Run(repo, search.Query{Text: q.Get("q"), Ref: q.Get("ref"), Case: q.Get("case") == "1", Word: q.Get("word") == "1", Regex: q.Get("regex") == "1"})
	if err != nil {
		helpers.Fail(w, err)
		return
	}
	helpers.JSON(w, res)
}

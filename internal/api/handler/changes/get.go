package changes

import (
	"net/http"

	"github.com/andersou/webdiffviewer/internal/api/helpers"
	"github.com/andersou/webdiffviewer/services/changes"
)

func (rt *Router) getStatus(w http.ResponseWriter, r *http.Request) {
	repo, err := helpers.Repo(rt.ws, r)
	if err != nil {
		helpers.Fail(w, err)
		return
	}
	q := r.URL.Query()
	list, err := changes.Status(repo, q.Get("base"), q.Get("wt") == "1")
	if err != nil {
		helpers.Fail(w, err)
		return
	}
	helpers.JSON(w, list)
}

func (rt *Router) getDiff(w http.ResponseWriter, r *http.Request) {
	repo, err := helpers.Repo(rt.ws, r)
	if err != nil {
		helpers.Fail(w, err)
		return
	}
	q := r.URL.Query()
	out, err := changes.Diff(repo, changes.DiffQuery{
		Path:         q.Get("path"),
		Orig:         q.Get("orig"),
		Commit:       q.Get("commit"),
		Untracked:    q.Get("untracked") == "1",
		Base:         q.Get("base"),
		WithWorktree: q.Get("wt") == "1",
		Staged:       q.Get("staged") == "1",
		HideIgnored:  rt.ws.CheckIgnore(),
	})
	if err != nil {
		helpers.Fail(w, err)
		return
	}
	helpers.Text(w, out)
}

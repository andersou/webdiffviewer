package files

import (
	"net/http"

	"github.com/andersou/webdiffviewer/internal/api/helpers"
	"github.com/andersou/webdiffviewer/services/files"
)

func (rt *Router) getFiles(w http.ResponseWriter, r *http.Request) {
	repo, err := helpers.Repo(rt.ws, r)
	if err != nil {
		helpers.Fail(w, err)
		return
	}
	list, err := files.List(repo)
	if err != nil {
		helpers.Fail(w, err)
		return
	}
	helpers.JSON(w, list)
}

func (rt *Router) getFile(w http.ResponseWriter, r *http.Request) {
	repo, err := helpers.Repo(rt.ws, r)
	if err != nil {
		helpers.Fail(w, err)
		return
	}
	buf, err := files.Read(repo, r.URL.Query().Get("path"), r.URL.Query().Get("rev"), rt.ws.CheckIgnore())
	if err != nil {
		helpers.Fail(w, err)
		return
	}
	helpers.Text(w, buf)
}

// getRaw serves a file as-is (images referenced by markdown previews).
func (rt *Router) getRaw(w http.ResponseWriter, r *http.Request) {
	repo, err := helpers.Repo(rt.ws, r)
	if err != nil {
		helpers.Fail(w, err)
		return
	}
	f, st, err := files.Open(repo, r.URL.Query().Get("path"), rt.ws.CheckIgnore())
	if err != nil {
		helpers.Fail(w, err)
		return
	}
	defer f.Close()
	// repo HTML/SVG opened directly must not run scripts with this origin's API access
	w.Header().Set("Content-Security-Policy", "sandbox")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeContent(w, r, st.Name(), st.ModTime(), f)
}

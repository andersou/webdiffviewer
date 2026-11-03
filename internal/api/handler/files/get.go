package files

import (
	"bytes"
	"net/http"
	"path"
	"time"

	"github.com/andersou/webdiffviewer/internal/api/helpers"
	"github.com/andersou/webdiffviewer/services/files"
)

func (rt *Router) getFiles(w http.ResponseWriter, r *http.Request) {
	repo, err := helpers.Repo(rt.ws, r)
	if err != nil {
		helpers.Fail(w, err)
		return
	}
	list, err := files.List(repo, r.URL.Query().Get("ref"))
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
	p, rev := r.URL.Query().Get("path"), r.URL.Query().Get("rev")
	// repo HTML/SVG opened directly must not run scripts with this origin's API access
	sandbox := func() {
		w.Header().Set("Content-Security-Policy", "sandbox")
		w.Header().Set("X-Content-Type-Options", "nosniff")
	}
	if rev != "" { // a branch viewed without checkout
		buf, err := files.Blob(repo, p, rev)
		if err != nil {
			helpers.Fail(w, err)
			return
		}
		sandbox()
		http.ServeContent(w, r, path.Base(p), time.Time{}, bytes.NewReader(buf))
		return
	}
	f, st, err := files.Open(repo, p, rt.ws.CheckIgnore())
	if err != nil {
		helpers.Fail(w, err)
		return
	}
	defer f.Close()
	sandbox()
	http.ServeContent(w, r, st.Name(), st.ModTime(), f)
}

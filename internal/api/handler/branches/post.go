package branches

import (
	"encoding/json"
	"net/http"

	"github.com/andersou/webdiffviewer/internal/api/helpers"
	"github.com/andersou/webdiffviewer/pkg/apperr"
	"github.com/andersou/webdiffviewer/services/branches"
)

func (rt *Router) postCheckout(w http.ResponseWriter, r *http.Request) {
	// requiring JSON forces a CORS preflight, so other sites can't trigger checkouts
	if r.Header.Get("Content-Type") != "application/json" {
		helpers.Fail(w, apperr.Unsupported("expected application/json"))
		return
	}
	repo, err := helpers.Repo(rt.ws, r)
	if err != nil {
		helpers.Fail(w, err)
		return
	}
	var body checkoutRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		helpers.Fail(w, apperr.BadRequest("bad branch"))
		return
	}
	out, err := branches.Switch(repo, body.Branch)
	if err != nil {
		helpers.Fail(w, err)
		return
	}
	w.Write(out)
}

// Package helpers has the request parsing and response writing shared by all handlers.
package helpers

import (
	"encoding/json"
	"net/http"

	"github.com/andersou/webdiffviewer/pkg/apperr"
)

func JSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func Text(w http.ResponseWriter, b []byte) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Write(b)
}

// Fail answers with err's message and the status from apperr (500 for plain errors).
func Fail(w http.ResponseWriter, err error) {
	http.Error(w, err.Error(), apperr.Status(err))
}

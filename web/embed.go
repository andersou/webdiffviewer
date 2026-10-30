// Package web exposes the built frontend (web/dist) to the Go binary.
// It lives here because go:embed can't reach parent directories.
package web

import (
	"embed"
	"io/fs"
)

//go:embed all:dist
var dist embed.FS

// Dist is the built frontend, rooted at dist/. Run `make build` first: the directory comes from Vite.
func Dist() fs.FS {
	sub, _ := fs.Sub(dist, "dist")
	return sub
}

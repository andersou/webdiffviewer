package commits

import "github.com/andersou/webdiffviewer/internal/git"

type commitResponse struct {
	Commit git.Commit   `json:"commit"`
	Files  []git.Change `json:"files"`
}

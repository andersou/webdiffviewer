// Package workspace knows which folders and repos the UI may browse: the command-line folder,
// any repo under --parent-dir, and the repos/worktrees discovered in them.
package workspace

import (
	"sync"

	"github.com/andersou/webdiffviewer/internal/git"
)

type Workspace struct {
	base    string // folder given on the command line
	parent  string // --parent-dir: other folders the UI may open; "" disables the picker
	mu      sync.RWMutex
	allowed map[string]bool // repo/worktree paths the API may touch, grown by Repos
}

type Repo struct {
	Path      string         `json:"path"`
	Name      string         `json:"name"`
	Branch    string         `json:"branch"`
	Worktrees []git.Worktree `json:"worktrees"`
}

type Folder struct {
	Path string `json:"path"`
	Name string `json:"name"`
}

type Config struct {
	Base   string `json:"base"`
	Parent string `json:"parent"`
}

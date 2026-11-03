package branches

import (
	"strings"

	"github.com/andersou/webdiffviewer/internal/git"
)

// List returns local and remote branches and the current one ("" when detached).
func List(repo string) (Branches, error) {
	args := []string{"for-each-ref", "--sort=-committerdate", "--format=%(HEAD)%(refname)", "refs/heads"}
	// only configured remotes: refs/remotes may keep stale refs of a deleted or never-added remote
	remotes, _ := git.Run(repo, "remote")
	for _, r := range strings.Fields(string(remotes)) {
		args = append(args, "refs/remotes/"+r)
	}
	out, err := git.Run(repo, args...)
	if err != nil {
		return Branches{}, err
	}
	res := Branches{Local: []string{}, Remote: []string{}}
	for _, l := range strings.Split(strings.TrimRight(string(out), "\n"), "\n") { // keep the leading HEAD marker (' ' or '*')
		if len(l) < 2 || strings.HasSuffix(l, "/HEAD") {
			continue
		}
		if b, ok := strings.CutPrefix(l[1:], "refs/heads/"); ok {
			res.Local = append(res.Local, b)
			if l[0] == '*' {
				res.Current = b
			}
		} else {
			res.Remote = append(res.Remote, strings.TrimPrefix(l[1:], "refs/remotes/"))
		}
	}
	return res, nil
}

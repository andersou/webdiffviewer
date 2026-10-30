package branches

import (
	"strings"

	"github.com/andersou/webdiffviewer/internal/git"
)

// List returns local and remote branches and the current one ("" when detached).
func List(repo string) (Branches, error) {
	out, err := git.Run(repo, "for-each-ref", "--format=%(HEAD)%(refname)", "refs/heads", "refs/remotes")
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

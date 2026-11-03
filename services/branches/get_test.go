package branches

import (
	"os/exec"
	"slices"
	"testing"
)

func TestListSkipsRefsOfUnknownRemotes(t *testing.T) {
	dir := t.TempDir()
	for _, args := range [][]string{
		{"init", "-q", "-b", "main"},
		{"-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "a"},
		{"remote", "add", "origin", "https://example.invalid/x.git"},
		{"update-ref", "refs/remotes/origin/main", "HEAD"},
		{"update-ref", "refs/remotes/stale/main", "HEAD"}, // no "stale" remote configured
	} {
		if out, err := exec.Command("git", append([]string{"-C", dir}, args...)...).CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v\n%s", args, err, out)
		}
	}
	b, err := List(dir)
	if err != nil || !slices.Equal(b.Remote, []string{"origin/main"}) || b.Current != "main" {
		t.Fatalf("got %+v %v", b, err)
	}
}

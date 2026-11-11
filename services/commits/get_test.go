package commits

import (
	"os/exec"
	"testing"
)

func TestLogOfEmptyRepo(t *testing.T) {
	dir := t.TempDir()
	if out, err := exec.Command("git", "-C", dir, "init", "-q").CombinedOutput(); err != nil {
		t.Fatalf("git init: %v\n%s", err, out)
	}
	list, err := Log(dir, 0, false, "")
	if err != nil || len(list) != 0 {
		t.Errorf("log of a repo with no commits: got %v, %v; want no commits and no error", list, err)
	}
}

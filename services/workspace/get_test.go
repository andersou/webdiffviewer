package workspace

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestRootStaysInParent(t *testing.T) {
	tmp, _ := filepath.EvalSymlinks(t.TempDir())
	parent, outside := filepath.Join(tmp, "parent"), filepath.Join(tmp, "outside")
	os.MkdirAll(filepath.Join(parent, "repo"), 0o755)
	os.MkdirAll(outside, 0o755)
	if err := os.Symlink(outside, filepath.Join(parent, "escape")); err != nil {
		t.Logf("no symlink support (%v); skipping that case", err) // Windows without developer mode
	}
	w := New(filepath.Join(parent, "repo"), parent, false, nil)
	get := w.Root
	if got, err := get(filepath.Join(parent, "repo")); err != nil || got != filepath.Join(parent, "repo") {
		t.Fatalf("inside parent: %q %v", got, err)
	}
	for _, bad := range []string{outside, filepath.Join(parent, "escape"), filepath.Join(parent, "..", "outside"), "/etc"} {
		if _, err := get(bad); err == nil {
			t.Fatalf("%s should be rejected", bad)
		}
	}
	w.parent = ""
	if _, err := get(filepath.Join(tmp, "parent")); err == nil {
		t.Fatal("picker disabled: other roots must be rejected")
	}
}

func TestReposListSubmoduleCheckoutsOfWorktrees(t *testing.T) {
	tmp, _ := filepath.EvalSymlinks(t.TempDir())
	run := func(dir string, args ...string) {
		cmd := exec.Command("git", append([]string{"-c", "protocol.file.allow=always", "-c", "user.name=t", "-c", "user.email=t@t"}, args...)...)
		cmd.Dir = dir
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v\n%s", args, err, out)
		}
	}
	run(tmp, "init", "-q", "-b", "main", "lib")
	run(filepath.Join(tmp, "lib"), "commit", "-q", "--allow-empty", "-m", "a")
	run(tmp, "init", "-q", "-b", "main", "app")
	app := filepath.Join(tmp, "app")
	run(app, "submodule", "add", "-q", "../lib", "lib")
	run(app, "commit", "-q", "-m", "s")
	run(app, "worktree", "add", "-q", "-b", "feat", filepath.Join(tmp, "app-feat"))
	run(filepath.Join(tmp, "app-feat"), "submodule", "update", "-q", "--init")

	repos, err := New(app, "", false, nil).Repos("")
	if err != nil {
		t.Fatal(err)
	}
	want := filepath.Join(tmp, "app-feat", "lib")
	for _, r := range repos {
		if r.Path == filepath.Join(app, "lib") && len(r.Worktrees) == 1 && r.Worktrees[0].Path == want {
			return
		}
	}
	t.Fatalf("lib should list %s as a worktree: %+v", want, repos)
}

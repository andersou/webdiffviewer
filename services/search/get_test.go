package search

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestRun(t *testing.T) {
	tmp, _ := filepath.EvalSymlinks(t.TempDir())
	run := func(dir string, args ...string) {
		cmd := exec.Command("git", append([]string{"-c", "protocol.file.allow=always", "-c", "user.name=t", "-c", "user.email=t@t"}, args...)...)
		cmd.Dir = dir
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v\n%s", args, err, out)
		}
	}
	lib, app := filepath.Join(tmp, "lib"), filepath.Join(tmp, "app")
	run(tmp, "init", "-q", "-b", "main", "lib")
	os.WriteFile(filepath.Join(lib, "l.txt"), []byte("Needle in lib\n"), 0o644)
	run(lib, "add", ".")
	run(lib, "commit", "-q", "-m", "a")
	run(tmp, "init", "-q", "-b", "main", "app")
	os.WriteFile(filepath.Join(app, "a.txt"), []byte("hay\nneedle here\n"), 0o644)
	run(app, "add", ".")
	run(app, "submodule", "add", "-q", "../lib", "lib")
	run(app, "commit", "-q", "-m", "s")
	run(app, "branch", "other")
	os.WriteFile(filepath.Join(app, "a.txt"), []byte("hay\nneedle changed\n"), 0o644) // only in the working tree

	got := func(q Query) Result {
		t.Helper()
		res, err := Run(app, q)
		if err != nil {
			t.Fatal(err)
		}
		return res
	}
	if r := got(Query{Text: "needle"}); len(r.Files) != 2 || r.Files[0].Path != "a.txt" || r.Files[0].Lines[0] != (Line{2, "needle changed"}) || r.Files[1].Path != "lib/l.txt" {
		t.Errorf("working tree + submodule: %+v", r)
	}
	if r := got(Query{Text: "needle", Case: true}); len(r.Files) != 1 {
		t.Errorf("match case should skip lib's Needle: %+v", r)
	}
	if r := got(Query{Text: "needle", Ref: "other"}); len(r.Files) != 1 || r.Files[0].Lines[0] != (Line{2, "needle here"}) {
		t.Errorf("at a branch, without submodules: %+v", r)
	}
	if r := got(Query{Text: "ne+dle", Regex: true}); len(r.Files) != 2 {
		t.Errorf("regex: %+v", r)
	}
	if r := got(Query{Text: "nope"}); len(r.Files) != 0 {
		t.Errorf("no match: %+v", r)
	}
	if _, err := Run(app, Query{Text: "(", Regex: true}); err == nil {
		t.Error("an invalid regex should be an error")
	}
	if _, err := Run(app, Query{Text: "x", Ref: "--output=/tmp/x"}); err == nil {
		t.Error("an option as ref should be rejected")
	}
}

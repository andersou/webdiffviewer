package main

import (
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestParseStatus(t *testing.T) {
	got := parseStatus("M  a.go\x00R  new.go\x00old.go\x00?? dir/x.txt\x00")
	want := []Change{
		{X: "M", Y: " ", Path: "a.go"},
		{X: "R", Y: " ", Path: "new.go", Orig: "old.go"},
		{X: "?", Y: "?", Path: "dir/x.txt"},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %+v", got)
	}
}

func TestParseWorktrees(t *testing.T) {
	out := "worktree /r\nHEAD 0123456789\nbranch refs/heads/main\n\nworktree /w\nHEAD abcdef0123\ndetached\n\nworktree /gone\nHEAD 1111111111\nprunable gitdir file points to non-existent location\n"
	got := parseWorktrees(out)
	want := []Worktree{{Path: "/r", Branch: "main", Head: "0123456"}, {Path: "/w", Head: "abcdef0"}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %+v", got)
	}
}

func TestParseNameStatus(t *testing.T) {
	got := parseNameStatus("M\x00a.go\x00R087\x00old.go\x00new.go\x00D\x00x\x00")
	want := []Change{
		{X: "M", Y: " ", Path: "a.go"},
		{X: "R", Y: " ", Path: "new.go", Orig: "old.go"},
		{X: "D", Y: " ", Path: "x"},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %+v", got)
	}
}

func TestWithWorktree(t *testing.T) {
	diff := []Change{{X: "M", Y: " ", Path: "a.txt"}, {X: "M", Y: " ", Path: "b.txt"}, {X: "A", Y: " ", Path: "staged.txt"}}
	status := []Change{{X: " ", Y: "M", Path: "b.txt"}, {X: "A", Y: " ", Path: "staged.txt"}, {X: "?", Y: "?", Path: "novo.txt"}}
	want := []Change{
		{X: "M", Y: " ", Path: "a.txt"},
		{X: "M", Y: " ", Path: "b.txt", Dirty: true},
		{X: "A", Y: " ", Path: "staged.txt", Dirty: true},
		{X: "?", Y: "?", Path: "novo.txt", Dirty: true},
	}
	if got := withWorktree(diff, status); !reflect.DeepEqual(got, want) {
		t.Fatalf("got %+v", got)
	}
}

func TestRootStaysInParent(t *testing.T) {
	tmp, _ := filepath.EvalSymlinks(t.TempDir())
	parent, outside := filepath.Join(tmp, "parent"), filepath.Join(tmp, "outside")
	os.MkdirAll(filepath.Join(parent, "repo"), 0o755)
	os.MkdirAll(outside, 0o755)
	if err := os.Symlink(outside, filepath.Join(parent, "escape")); err != nil {
		t.Logf("no symlink support (%v); skipping that case", err) // Windows without developer mode
	}
	s := &server{base: filepath.Join(parent, "repo"), parent: parent}
	get := func(root string) (string, error) {
		return s.root(httptest.NewRequest("GET", "/api/repos?"+url.Values{"root": {root}}.Encode(), nil))
	}
	if got, err := get(filepath.Join(parent, "repo")); err != nil || got != filepath.Join(parent, "repo") {
		t.Fatalf("inside parent: %q %v", got, err)
	}
	for _, bad := range []string{outside, filepath.Join(parent, "escape"), filepath.Join(parent, "..", "outside"), "/etc"} {
		if _, err := get(bad); err == nil {
			t.Fatalf("%s should be rejected", bad)
		}
	}
	s.parent = ""
	if _, err := get(filepath.Join(tmp, "parent")); err == nil {
		t.Fatal("picker disabled: other roots must be rejected")
	}
}

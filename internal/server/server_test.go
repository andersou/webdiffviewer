package server

import (
	"net/http/httptest"
	"net/url"
	"os"
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
	s := New(filepath.Join(parent, "repo"), parent, nil)
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

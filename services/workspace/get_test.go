package workspace

import (
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
	w := New(filepath.Join(parent, "repo"), parent)
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

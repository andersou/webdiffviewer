package git

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestRunLimit(t *testing.T) {
	if _, err := RunLimit(".", 3, "--version"); !errors.Is(err, ErrTooLarge) { // "git version ..." is longer than 3 bytes
		t.Fatalf("want ErrTooLarge, got %v", err)
	}
	if out, err := RunLimit(".", 1<<20, "--version"); err != nil || len(out) == 0 {
		t.Fatalf("within the limit: %q %v", out, err)
	}
}

func TestIsIgnored(t *testing.T) {
	dir := t.TempDir()
	if out, err := exec.Command("git", "-C", dir, "init", "-q").CombinedOutput(); err != nil {
		t.Fatalf("git init: %v %s", err, out)
	}
	os.WriteFile(filepath.Join(dir, ".gitignore"), []byte(".env\n"), 0o644)
	if !IsIgnored(dir, ".env") || IsIgnored(dir, "main.go") {
		t.Fatal(".env must be ignored and main.go not")
	}
	if !IsIgnored(filepath.Join(dir, "missing"), "x") {
		t.Fatal("errors must count as ignored (fail closed)")
	}
}

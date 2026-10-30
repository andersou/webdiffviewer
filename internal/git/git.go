// Package git runs the git CLI and parses its machine-readable output. It knows nothing about HTTP.
package git

import (
	"bytes"
	"errors"
	"fmt"
	"io/fs"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

// Run executes git in dir and returns stdout; the error carries git's stderr.
func Run(dir string, args ...string) ([]byte, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	out, err := cmd.Output()
	if err != nil {
		return out, fmt.Errorf("git %s: %w: %s", strings.Join(args, " "), err, strings.TrimSpace(stderr.String()))
	}
	return out, nil
}

var hashRe = regexp.MustCompile(`^[0-9a-f]{4,64}$`)

// IsHash accepts abbreviated or full commit ids; anything else (refs, options) is rejected.
func IsHash(s string) bool { return hashRe.MatchString(s) }

// MergeBase returns the fork point of HEAD and base, so a diff shows only this branch's changes (PR-style).
func MergeBase(repo, base string) (string, error) {
	if strings.HasPrefix(base, "-") {
		return "", errors.New("bad base")
	}
	out, err := Run(repo, "merge-base", base, "HEAD")
	return strings.TrimSpace(string(out)), err
}

// Discover finds the repo containing base plus every git repo/submodule below it (like VS Code's repo scan).
func Discover(base string) []string {
	seen := map[string]bool{}
	var paths []string
	add := func(p string) {
		p = filepath.Clean(p) // git prints C:/x on Windows; filepath uses C:\x
		if !seen[p] {
			seen[p] = true
			paths = append(paths, p)
		}
	}
	if top, err := Run(base, "rev-parse", "--show-toplevel"); err == nil {
		add(strings.TrimSpace(string(top)))
	}
	filepath.WalkDir(base, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		name := d.Name()
		if name == ".git" {
			add(filepath.Dir(p))
			if d.IsDir() {
				return fs.SkipDir
			}
			return nil
		}
		if d.IsDir() && p != base {
			rel, _ := filepath.Rel(base, p)
			if strings.HasPrefix(name, ".") || name == "node_modules" || strings.Count(rel, string(filepath.Separator)) >= 6 {
				return fs.SkipDir
			}
		}
		return nil
	})
	sort.Strings(paths)
	return paths
}

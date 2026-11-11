package files

import (
	"strings"
	"testing"
)

func TestParseBlameSHA256(t *testing.T) {
	sha := strings.Repeat("ab", 32)
	zero := strings.Repeat("0", 64)
	out := sha + " 1 1 1\nauthor t\nsummary init\nfilename a.txt\n\tone\n" +
		zero + " 2 2 1\nauthor Not Committed Yet\nsummary Version of a.txt from a.txt\nfilename a.txt\n\ttwo\n"
	b := parseBlame(out)
	if len(b.Lines) != 2 || b.Lines[0].Commit != sha || b.Lines[1].Commit != "" || b.Commits[sha].Summary != "init" || len(b.Commits) != 1 {
		t.Errorf("blame of a SHA-256 repo: %+v", b)
	}
}

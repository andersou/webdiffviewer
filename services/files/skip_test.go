package files

import (
	"slices"
	"testing"
)

func TestParseSkip(t *testing.T) {
	got, err := ParseSkip(" node_modules, .venv,,target ")
	if err != nil || !slices.Equal(got, []string{"node_modules", ".venv", "target"}) {
		t.Errorf("ParseSkip: got %v, %v", got, err)
	}
	if got, err := ParseSkip(""); err != nil || len(got) != 0 {
		t.Errorf("ParseSkip empty: got %v, %v", got, err) // nothing skipped
	}
	for _, bad := range []string{"out/tmp", `a\b`, "..", "."} {
		if _, err := ParseSkip(bad); err == nil {
			t.Errorf("ParseSkip(%q): want an error, a name can't be a path", bad)
		}
	}
}

package git

import (
	"fmt"
	"strings"
)

type Worktree struct {
	Path   string `json:"path"`
	Branch string `json:"branch"`
	Head   string `json:"head"`
}

type Change struct {
	X    string `json:"x"` // index status
	Y    string `json:"y"` // worktree status
	Path string `json:"path"`
	Orig string `json:"orig,omitempty"`
	// Dirty marks entries of a branch comparison that also have uncommitted (staged, unstaged or untracked) changes
	Dirty bool `json:"dirty,omitempty"`
}

type Commit struct {
	Hash    string   `json:"hash"`
	Parents []string `json:"parents"`
	Author  string   `json:"author"`
	Email   string   `json:"email,omitempty"`
	Time    int64    `json:"time"`
	Refs    []string `json:"refs"`
	Subject string   `json:"subject"`
	Body    string   `json:"body,omitempty"`
}

// LogFormat: fields split by NUL, records by RS (\x1e), so subjects/bodies may contain anything else.
const LogFormat = "%H%x00%P%x00%an%x00%ae%x00%at%x00%D%x00%s%x00%b%x1e"

// ParseWorktrees reads `git worktree list --porcelain`, skipping bare and prunable entries.
func ParseWorktrees(out string) []Worktree {
	var list []Worktree
	for _, block := range strings.Split(strings.TrimSpace(out), "\n\n") {
		var wt Worktree
		skip := false
		for _, l := range strings.Split(block, "\n") {
			k, v, _ := strings.Cut(l, " ")
			switch k {
			case "worktree":
				wt.Path = v
			case "HEAD":
				wt.Head = v[:min(7, len(v))]
			case "branch":
				wt.Branch = strings.TrimPrefix(v, "refs/heads/")
			case "bare", "prunable":
				skip = true // nothing to view
			}
		}
		if wt.Path != "" && !skip {
			list = append(list, wt)
		}
	}
	return list
}

// ParseStatus reads `git status --porcelain=v1 -z`.
func ParseStatus(out string) []Change {
	list := []Change{}
	parts := strings.Split(out, "\x00")
	for i := 0; i < len(parts); i++ {
		p := parts[i]
		if len(p) < 4 {
			continue
		}
		c := Change{X: p[:1], Y: p[1:2], Path: p[3:]}
		if strings.ContainsAny(p[:2], "RC") && i+1 < len(parts) {
			i++
			c.Orig = parts[i]
		}
		list = append(list, c)
	}
	return list
}

// ParseNameStatus reads `git diff --name-status -z`: "M\0path\0" or "R100\0old\0new\0".
func ParseNameStatus(out string) []Change {
	list := []Change{}
	parts := strings.Split(out, "\x00")
	for i := 0; i+1 < len(parts); i += 2 {
		if parts[i] == "" { // stray separator (e.g. after git show's header): skip it, never index it
			i--
			continue
		}
		c := Change{X: parts[i][:1], Y: " ", Path: parts[i+1]}
		if (c.X == "R" || c.X == "C") && i+2 < len(parts) {
			c.Orig, c.Path = parts[i+1], parts[i+2]
			i++
		}
		list = append(list, c)
	}
	return list
}

// WithWorktree merges `git status` into a branch comparison: flags entries that have
// uncommitted edits and adds untracked files, which `git diff <base>` never lists.
func WithWorktree(diff, status []Change) []Change {
	dirty := map[string]bool{}
	for _, c := range status {
		if c.X == "?" {
			diff = append(diff, Change{X: "?", Y: "?", Path: c.Path, Dirty: true})
		} else {
			dirty[c.Path] = true
		}
	}
	for i := range diff {
		if dirty[diff[i].Path] {
			diff[i].Dirty = true
		}
	}
	return diff
}

// ParseLog reads `git log --format=<LogFormat>`.
func ParseLog(out string) []Commit {
	list := []Commit{}
	for _, rec := range strings.Split(out, "\x1e") {
		f := strings.Split(strings.TrimLeft(rec, "\n"), "\x00")
		if len(f) < 8 {
			continue
		}
		c := Commit{Hash: f[0], Parents: strings.Fields(f[1]), Author: f[2], Email: f[3], Subject: f[6], Body: strings.TrimSpace(f[7]), Refs: []string{}}
		fmt.Sscan(f[4], &c.Time)
		for _, r := range strings.Split(f[5], ", ") {
			if r = strings.TrimSpace(r); r != "" {
				c.Refs = append(c.Refs, r)
			}
		}
		list = append(list, c)
	}
	return list
}

// ParseShow splits `git show --format=<LogFormat> --name-status -z` into the commit and its files.
func ParseShow(out string) (Commit, []Change, bool) {
	head, files, ok := strings.Cut(out, "\x1e")
	info := ParseLog(head + "\x1e")
	if !ok || len(info) != 1 {
		return Commit{}, nil, false
	}
	// with -z git ends the header with "\x1e\x00\n" before the file list
	return info[0], ParseNameStatus(strings.TrimLeft(files, "\x00\n")), true
}

// Package changes computes what changed in a repo: working tree status, branch comparisons
// and per-file diffs.
package changes

// DiffQuery selects which diff of Path to show. Exactly one source applies, in this order:
// Commit (what that commit changed), Untracked (whole new file), Base (vs the merge-base with
// that branch, plus the working tree when WithWorktree), Staged (index vs HEAD), else working tree.
type DiffQuery struct {
	Path         string
	Orig         string // previous path of a rename/copy, if any
	Commit       string
	Untracked    bool
	Base         string
	WithWorktree bool
	Staged       bool
}

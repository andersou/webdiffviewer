// Package files reads repo files: the tracked/untracked list, text contents at a given
// version, and raw files for the markdown preview.
package files

// MaxSize is the largest text file Read returns.
const MaxSize = 5 << 20

// Files is the Explorer list: tracked and untracked files, and the gitignored ones apart.
type Files struct {
	Files   []string `json:"files"`
	Ignored []string `json:"ignored"`
}

// BlameCommit is what blame shows about the commit that last changed a line.
type BlameCommit struct {
	Author  string `json:"author"`
	Time    int64  `json:"time"`
	Summary string `json:"summary"`
	Path    string `json:"path"` // the file's path in that commit (it may have been renamed since)
}

// BlameLine is one line of the file and the commit that last changed it ("" = not committed yet).
type BlameLine struct {
	Commit string `json:"c"`
	Text   string `json:"text"`
}

type BlameResult struct {
	Commits map[string]BlameCommit `json:"commits"`
	Lines   []BlameLine            `json:"lines"`
}

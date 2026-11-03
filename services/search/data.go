// Package search finds text in a repo's files (git grep), like VS Code's Search view.
package search

// MaxOutput caps git grep's output; past it the results are cut and Truncated is set.
const MaxOutput = 2 << 20

// maxPerFile caps the lines listed per file, so one huge match list doesn't hide the rest.
const maxPerFile = 100

// maxLine cuts long lines (minified files), keeping the start where the match usually is.
const maxLine = 300

type Query struct {
	Text  string
	Ref   string // branch viewed without checkout; "" = the working tree
	Case  bool   // match case
	Word  bool   // whole word
	Regex bool   // Text is an extended regex, else a literal string
}

type Line struct {
	N    int    `json:"n"`
	Text string `json:"text"`
}

type File struct {
	Path  string `json:"path"`
	Lines []Line `json:"lines"`
}

type Result struct {
	Files     []File `json:"files"`
	Truncated bool   `json:"truncated"`
}

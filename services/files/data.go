// Package files reads repo files: the tracked/untracked list, text contents at a given
// version, and raw files for the markdown preview.
package files

// MaxSize is the largest text file Read returns.
const MaxSize = 5 << 20

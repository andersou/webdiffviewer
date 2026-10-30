// Package branches lists and switches git branches.
package branches

type Branches struct {
	Current string   `json:"current"`
	Local   []string `json:"local"`
	Remote  []string `json:"remote"`
}

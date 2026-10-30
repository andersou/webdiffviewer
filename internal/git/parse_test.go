package git

import (
	"reflect"
	"testing"
)

func TestParseStatus(t *testing.T) {
	got := ParseStatus("M  a.go\x00R  new.go\x00old.go\x00?? dir/x.txt\x00")
	want := []Change{
		{X: "M", Y: " ", Path: "a.go"},
		{X: "R", Y: " ", Path: "new.go", Orig: "old.go"},
		{X: "?", Y: "?", Path: "dir/x.txt"},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %+v", got)
	}
}

func TestParseWorktrees(t *testing.T) {
	out := "worktree /r\nHEAD 0123456789\nbranch refs/heads/main\n\nworktree /w\nHEAD abcdef0123\ndetached\n\nworktree /gone\nHEAD 1111111111\nprunable gitdir file points to non-existent location\n"
	got := ParseWorktrees(out)
	want := []Worktree{{Path: "/r", Branch: "main", Head: "0123456"}, {Path: "/w", Head: "abcdef0"}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %+v", got)
	}
}

func TestParseNameStatus(t *testing.T) {
	got := ParseNameStatus("M\x00a.go\x00R087\x00old.go\x00new.go\x00D\x00x\x00")
	want := []Change{
		{X: "M", Y: " ", Path: "a.go"},
		{X: "R", Y: " ", Path: "new.go", Orig: "old.go"},
		{X: "D", Y: " ", Path: "x"},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %+v", got)
	}
}

func TestWithWorktree(t *testing.T) {
	diff := []Change{{X: "M", Y: " ", Path: "a.txt"}, {X: "M", Y: " ", Path: "b.txt"}, {X: "A", Y: " ", Path: "staged.txt"}}
	status := []Change{{X: " ", Y: "M", Path: "b.txt"}, {X: "A", Y: " ", Path: "staged.txt"}, {X: "?", Y: "?", Path: "novo.txt"}}
	want := []Change{
		{X: "M", Y: " ", Path: "a.txt"},
		{X: "M", Y: " ", Path: "b.txt", Dirty: true},
		{X: "A", Y: " ", Path: "staged.txt", Dirty: true},
		{X: "?", Y: "?", Path: "novo.txt", Dirty: true},
	}
	if got := WithWorktree(diff, status); !reflect.DeepEqual(got, want) {
		t.Fatalf("got %+v", got)
	}
}

func TestParseLog(t *testing.T) {
	out := "aaa\x00bbb ccc\x00Ana\x00ana@x\x001700000000\x00HEAD -> main, tag: v1.0.0\x00merge: a, b | c\x00body\nline 2\n\x1e\n" +
		"bbb\x00\x00Bo\x00bo@x\x001600000000\x00\x00root\x00\x1e\n"
	got := ParseLog(out)
	want := []Commit{
		{Hash: "aaa", Parents: []string{"bbb", "ccc"}, Author: "Ana", Email: "ana@x", Time: 1700000000, Refs: []string{"HEAD -> main", "tag: v1.0.0"}, Subject: "merge: a, b | c", Body: "body\nline 2"},
		{Hash: "bbb", Parents: []string{}, Author: "Bo", Email: "bo@x", Time: 1600000000, Refs: []string{}, Subject: "root"},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %#v", got)
	}
}

func TestIsHash(t *testing.T) {
	for _, ok := range []string{"abcd", "0123456789abcdef0123456789abcdef01234567"} {
		if !IsHash(ok) {
			t.Errorf("%q should be a hash", ok)
		}
	}
	for _, bad := range []string{"", "abc", "HEAD", "--output=x", "main", "ABCD", "abcd^1"} {
		if IsHash(bad) {
			t.Errorf("%q should be rejected", bad)
		}
	}
}

func TestParseShow(t *testing.T) {
	// real git show -z output: the header ends with RS, NUL, newline
	out := "abc\x00def\x00Ana\x00a@x\x001700000000\x00\x00subject\x00body\n\x1e\x00\nM\x00a.go\x00R090\x00old.go\x00new.go\x00"
	c, files, ok := ParseShow(out)
	if !ok || c.Hash != "abc" || c.Subject != "subject" || c.Body != "body" {
		t.Fatalf("commit %+v ok=%v", c, ok)
	}
	want := []Change{{X: "M", Y: " ", Path: "a.go"}, {X: "R", Y: " ", Path: "new.go", Orig: "old.go"}}
	if !reflect.DeepEqual(files, want) {
		t.Fatalf("files %+v", files)
	}
	if _, files, _ := ParseShow("abc\x00\x00A\x00a@x\x001\x00\x00empty\x00\x1e\x00\n"); len(files) != 0 {
		t.Fatalf("no files expected, got %+v", files)
	}
}

func TestParseNameStatusIgnoresStraySeparators(t *testing.T) {
	got := ParseNameStatus("\x00\x00M\x00a.go\x00\x00D\x00b.go\x00")
	want := []Change{{X: "M", Y: " ", Path: "a.go"}, {X: "D", Y: " ", Path: "b.go"}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %+v", got)
	}
}

package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/andersou/webdiffviewer/services/workspace"
)

// newRepo makes a repo with one commit, then a modified, a staged and an untracked file.
func newRepo(t *testing.T) string {
	t.Helper()
	dir, _ := filepath.EvalSymlinks(t.TempDir())
	run := func(args ...string) {
		cmd := exec.Command("git", args...)
		cmd.Dir = dir
		cmd.Env = append(os.Environ(), "GIT_AUTHOR_NAME=t", "GIT_AUTHOR_EMAIL=t@t", "GIT_COMMITTER_NAME=t", "GIT_COMMITTER_EMAIL=t@t")
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v\n%s", args, err, out)
		}
	}
	write := func(name, body string) { os.WriteFile(filepath.Join(dir, name), []byte(body), 0o644) }
	run("init", "-q", "-b", "main")
	write("a.txt", "one\n")
	write("b.txt", "bee\n")
	run("add", ".")
	run("commit", "-q", "-m", "init")
	write("a.txt", "one\ntwo\n")
	write("b.txt", "BEE\n")
	run("add", "b.txt")
	write("new.txt", "new\n")
	write(".gitignore", ".env\n")
	write(".env", "SECRET=hunter2\n")
	run("config", "remote.origin.url", "https://user:TOKEN@example.com/x.git")
	// a feature branch with one commit, checked out in a worktree, to compare against main
	run("worktree", "add", "-q", "-b", "feature", filepath.Join(dir, "..", filepath.Base(dir)+"-feature"))
	return dir
}

// commitOnFeature adds feature.txt on the feature branch and returns the worktree path.
func commitOnFeature(t *testing.T, repo string) string {
	t.Helper()
	wt := filepath.Join(repo, "..", filepath.Base(repo)+"-feature")
	os.WriteFile(filepath.Join(wt, "feature.txt"), []byte("feat\n"), 0o644)
	for _, args := range [][]string{{"add", "feature.txt"}, {"commit", "-q", "-m", "feat"}} {
		cmd := exec.Command("git", args...)
		cmd.Dir = wt
		cmd.Env = append(os.Environ(), "GIT_AUTHOR_NAME=t", "GIT_AUTHOR_EMAIL=t@t", "GIT_COMMITTER_NAME=t", "GIT_COMMITTER_EMAIL=t@t")
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v\n%s", args, err, out)
		}
	}
	os.WriteFile(filepath.Join(wt, "dirty.txt"), []byte("wip\n"), 0o644) // untracked on the feature worktree
	return wt
}

func TestAPI(t *testing.T) {
	repo := newRepo(t)
	wt := commitOnFeature(t, repo)
	web := fstest.MapFS{"index.html": {Data: []byte("<html>")}}
	h := New(workspace.New(repo, "", false), web, []string{"mac.local"})
	do := func(method, target, contentType, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, target, strings.NewReader(body))
		req.Host = "127.0.0.1:8080"
		if contentType != "" {
			req.Header.Set("Content-Type", contentType)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec
	}
	get := func(path string, params url.Values) *httptest.ResponseRecorder {
		return do("GET", path+"?"+params.Encode(), "", "")
	}
	q := func(kv ...string) url.Values {
		v := url.Values{"repo": {repo}}
		for i := 0; i < len(kv); i += 2 {
			v.Set(kv[i], kv[i+1])
		}
		return v
	}
	expect := func(name string, rec *httptest.ResponseRecorder, status int, contains string) {
		t.Helper()
		if rec.Code != status || !strings.Contains(rec.Body.String(), contains) {
			t.Errorf("%s: got %d %q, want %d containing %q", name, rec.Code, rec.Body.String(), status, contains)
		}
	}

	// before /api/repos lists it, the repo is off limits
	expect("unlisted repo", get("/api/status", q()), http.StatusForbidden, "unknown repo")
	expect("repos", get("/api/repos", nil), http.StatusOK, `"branch":"main"`)

	var status []map[string]string
	json.Unmarshal(get("/api/status", q()).Body.Bytes(), &status)
	if len(status) != 4 { // .env is ignored, so it must not appear
		t.Errorf("status: got %v, want a.txt, b.txt, .gitignore and new.txt", status)
	}
	expect("branches", get("/api/branches", q()), http.StatusOK, `"current":"main"`)
	expect("files", get("/api/files", q()), http.StatusOK, "new.txt")
	expect("diff", get("/api/diff", q("path", "a.txt")), http.StatusOK, "+two")
	expect("staged diff", get("/api/diff", q("path", "b.txt", "staged", "1")), http.StatusOK, "+BEE")
	expect("untracked diff", get("/api/diff", q("path", "new.txt", "untracked", "1")), http.StatusOK, "+new")
	expect("file on disk", get("/api/file", q("path", "a.txt")), http.StatusOK, "two")
	expect("file at HEAD", get("/api/file", q("path", "a.txt", "rev", "HEAD")), http.StatusOK, "one")
	expect("raw", get("/api/raw", q("path", "a.txt")), http.StatusOK, "one")

	var log []map[string]any
	json.Unmarshal(get("/api/log", q()).Body.Bytes(), &log)
	if len(log) != 1 {
		t.Fatalf("log: got %v", log)
	}
	expect("commit", get("/api/commit", q("hash", log[0]["hash"].(string))), http.StatusOK, `"path":"a.txt"`)

	// protections
	expect("path escape", get("/api/file", q("path", "../secret")), http.StatusBadRequest, "bad path")
	expect("bad hash", get("/api/commit", q("hash", "HEAD")), http.StatusBadRequest, "bad commit")
	expect("bad rev", get("/api/file", q("path", "a.txt", "rev", "main")), http.StatusBadRequest, "rev must be")
	expect("checkout without JSON", do("POST", "/api/checkout?"+q().Encode(), "text/plain", "branch=main"), http.StatusUnsupportedMediaType, "")
	expect("checkout option", do("POST", "/api/checkout?"+q().Encode(), "application/json", `{"branch":"-f"}`), http.StatusBadRequest, "bad branch")
	expect("no parent dir", get("/api/folders", nil), http.StatusNotFound, "--parent-dir")
	expect("static", get("/", nil), http.StatusOK, "<html>")

	// .git (tokens in remote URLs) is never served
	expect(".git via file", get("/api/file", q("path", ".git/config")), http.StatusBadRequest, "bad path")
	expect(".git via raw", get("/api/raw", q("path", ".git/config")), http.StatusBadRequest, "bad path")
	expect(".GIT any case", get("/api/file", q("path", "sub/.GIT/config")), http.StatusBadRequest, "bad path")
	// gitignored files are served by default...
	expect("ignored file, default", get("/api/file", q("path", ".env")), http.StatusOK, "hunter2")
	// ...and hidden with --check-ignore
	strict := New(workspace.New(repo, "", true), web, nil)
	for name, target := range map[string]string{
		"file": "/api/file?" + q("path", ".env").Encode(),
		"raw":  "/api/raw?" + q("path", ".env").Encode(),
		"diff": "/api/diff?" + q("path", ".env", "untracked", "1").Encode(),
	} {
		list := httptest.NewRequest("GET", "/api/repos", nil) // list the repo first, so it is allowed
		list.Host = "127.0.0.1"
		strict.ServeHTTP(httptest.NewRecorder(), list)
		req := httptest.NewRequest("GET", target, nil)
		req.Host = "127.0.0.1"
		rec := httptest.NewRecorder()
		strict.ServeHTTP(rec, req)
		if rec.Code != http.StatusNotFound || strings.Contains(rec.Body.String(), "hunter2") {
			t.Errorf("--check-ignore %s: got %d %q, want 404 without the secret", name, rec.Code, rec.Body.String())
		}
	}

	// branch comparison, from the feature worktree against main
	qf := func(kv ...string) url.Values { v := q(kv...); v.Set("repo", wt); return v }
	paths := func(rec *httptest.ResponseRecorder) string {
		var list []map[string]any
		json.Unmarshal(rec.Body.Bytes(), &list)
		var out []string
		for _, c := range list {
			out = append(out, c["path"].(string))
		}
		return strings.Join(out, ",")
	}
	if got := paths(get("/api/status", qf("base", "main", "wt", "0"))); got != "feature.txt" {
		t.Errorf("base without worktree: got %q, want only the committed feature.txt", got)
	}
	if got := paths(get("/api/status", qf("base", "main", "wt", "1"))); got != "feature.txt,dirty.txt" {
		t.Errorf("base with worktree: got %q, want feature.txt and the untracked dirty.txt", got)
	}
	expect("diff vs base", get("/api/diff", qf("path", "feature.txt", "base", "main")), http.StatusOK, "+feat")
	expect("bad base", get("/api/status", qf("base", "--output=/tmp/x")), http.StatusBadRequest, "bad base")
	var featLog []map[string]any
	json.Unmarshal(get("/api/log", qf()).Body.Bytes(), &featLog)
	expect("diff in commit", get("/api/diff", qf("path", "feature.txt", "commit", featLog[0]["hash"].(string))), http.StatusOK, "+feat")

	// Host header: IP addresses, localhost and --allowed-hosts pass; other names (DNS rebinding) don't
	for host, status := range map[string]int{"192.168.1.10:8080": http.StatusOK, "localhost:8080": http.StatusOK, "[::1]:8080": http.StatusOK, "MAC.local:8080": http.StatusOK, "evil.example:8080": http.StatusForbidden} {
		req := httptest.NewRequest("GET", "/api/config", nil)
		req.Host = host
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != status {
			t.Errorf("Host %s: got %d, want %d", host, rec.Code, status)
		}
	}
}

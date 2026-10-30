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
	return dir
}

func TestAPI(t *testing.T) {
	repo := newRepo(t)
	h := New(workspace.New(repo, ""), fstest.MapFS{"index.html": {Data: []byte("<html>")}}, "127.0.0.1")
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
	if len(status) != 3 {
		t.Errorf("status: got %v, want a.txt, b.txt and new.txt", status)
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

	foreign := httptest.NewRequest("GET", "/api/repos", nil)
	foreign.Host = "evil.example:8080"
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, foreign)
	expect("foreign host", rec, http.StatusForbidden, "forbidden host")
}

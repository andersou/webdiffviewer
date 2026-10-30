package main

import (
	"embed"
	"flag"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
)

//go:embed all:web/dist
var dist embed.FS

func main() {
	host := flag.String("host", "127.0.0.1", "address to listen on")
	port := flag.Int("port", 8080, "port to listen on")
	parentDir := flag.String("parent-dir", "", "let the UI open any git repo under this folder (Ctrl/Cmd+K)")
	flag.Usage = func() {
		os.Stderr.WriteString("usage: webdiffviewer [-host H] [-port P] [-parent-dir D] [dir]\n")
		flag.PrintDefaults()
	}
	flag.Parse()

	dir := "."
	if flag.NArg() > 0 {
		dir = flag.Arg(0)
	}
	base, err := realPath(dir)
	if err != nil {
		log.Fatal(err)
	}
	parent := ""
	if *parentDir != "" {
		if parent, err = realPath(*parentDir); err != nil {
			log.Fatal(err)
		}
	}

	s := &server{base: base, parent: parent, allowed: map[string]bool{}}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/config", s.config)
	mux.HandleFunc("GET /api/folders", s.folders)
	mux.HandleFunc("GET /api/repos", s.repos)
	mux.HandleFunc("GET /api/branches", s.withRepo(s.branches))
	mux.HandleFunc("POST /api/checkout", s.withRepo(s.checkout))
	mux.HandleFunc("GET /api/files", s.withRepo(s.files))
	mux.HandleFunc("GET /api/status", s.withRepo(s.status))
	mux.HandleFunc("GET /api/diff", s.withRepo(s.diff))
	mux.HandleFunc("GET /api/file", s.withRepo(s.file))
	mux.HandleFunc("GET /api/raw", s.withRepo(s.raw))
	web, _ := fs.Sub(dist, "web/dist")
	mux.Handle("/", http.FileServerFS(web))

	addr := net.JoinHostPort(*host, strconv.Itoa(*port))
	log.Printf("webdiffviewer: %s -> http://%s", base, addr)
	log.Fatal(http.ListenAndServe(addr, hostGuard(*host, mux)))
}

// realPath makes p absolute and resolves symlinks: git reports real paths (e.g. /private/var, not /var)
func realPath(p string) (string, error) {
	abs, err := filepath.Abs(p)
	if err != nil {
		return "", err
	}
	return filepath.EvalSymlinks(abs)
}

// hostGuard blocks DNS-rebinding when bound to loopback: only loopback Host headers are accepted.
func hostGuard(bind string, h http.Handler) http.Handler {
	if !isLoopback(bind) {
		return h
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hn, _, err := net.SplitHostPort(r.Host)
		if err != nil {
			hn = r.Host
		}
		if !isLoopback(hn) {
			http.Error(w, "forbidden host", http.StatusForbidden)
			return
		}
		h.ServeHTTP(w, r)
	})
}

func isLoopback(h string) bool {
	ip := net.ParseIP(h)
	return h == "localhost" || ip != nil && ip.IsLoopback()
}

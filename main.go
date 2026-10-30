// Command webdiffviewer serves a VS Code-style git UI for the repos in a folder.
package main

import (
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/andersou/webdiffviewer/internal/server"
)

//go:embed all:web/dist
var dist embed.FS

// version is set by release builds: go build -ldflags "-X main.version=1.2.3"
var version = "dev"

func main() {
	host := flag.String("host", "127.0.0.1", "address to listen on")
	port := flag.Int("port", 8080, "port to listen on")
	parentDir := flag.String("parent-dir", "", "let the UI open any git repo under this folder (Ctrl/Cmd+K)")
	showVersion := flag.Bool("version", false, "print the version and exit")
	flag.Usage = func() {
		os.Stderr.WriteString("usage: webdiffviewer [-host H] [-port P] [-parent-dir D] [dir]\n")
		flag.PrintDefaults()
	}
	flag.Parse()
	if *showVersion {
		fmt.Println("webdiffviewer " + version)
		return
	}

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

	web, _ := fs.Sub(dist, "web/dist")
	addr := net.JoinHostPort(*host, strconv.Itoa(*port))
	log.Printf("webdiffviewer: %s -> http://%s", base, addr)
	log.Fatal(http.ListenAndServe(addr, server.New(base, parent, web).Handler(*host)))
}

// realPath makes p absolute and resolves symlinks: git reports real paths (e.g. /private/var, not /var)
func realPath(p string) (string, error) {
	abs, err := filepath.Abs(p)
	if err != nil {
		return "", err
	}
	return filepath.EvalSymlinks(abs)
}

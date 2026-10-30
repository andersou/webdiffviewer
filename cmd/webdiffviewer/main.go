// Command webdiffviewer serves a VS Code-style git UI for the repos in a folder.
package main

import (
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/andersou/webdiffviewer/internal/api"
	"github.com/andersou/webdiffviewer/services/workspace"
	"github.com/andersou/webdiffviewer/web"
)

// version is set by release builds: go build -ldflags "-X main.version=1.2.3"
var version = "dev"

func main() {
	host := flag.String("host", "127.0.0.1", "address to listen on")
	port := flag.Int("port", 8080, "port to listen on")
	parentDir := flag.String("parent-dir", "", "let the UI open any git repo under this folder (Ctrl/Cmd+K)")
	checkIgnore := flag.Bool("check-ignore", false, "never serve gitignored files (.env and other local secrets)")
	allowedHosts := flag.String("allowed-hosts", "", "comma-separated host names accepted besides IPs and localhost (e.g. mac.local)")
	showVersion := flag.Bool("version", false, "print the version and exit")
	flag.Usage = func() {
		os.Stderr.WriteString("usage: webdiffviewer [-host H] [-port P] [-parent-dir D] [-check-ignore] [-allowed-hosts h1,h2] [dir]\n")
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

	addr := net.JoinHostPort(*host, strconv.Itoa(*port))
	log.Printf("webdiffviewer: %s -> http://%s", base, addr)
	log.Fatal(http.ListenAndServe(addr, api.New(workspace.New(base, parent, *checkIgnore), web.Dist(), splitList(*allowedHosts))))
}

// realPath makes p absolute and resolves symlinks: git reports real paths (e.g. /private/var, not /var)
func realPath(p string) (string, error) {
	abs, err := filepath.Abs(p)
	if err != nil {
		return "", err
	}
	return filepath.EvalSymlinks(abs)
}

// splitList turns "a, b,,c" into [a b c].
func splitList(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

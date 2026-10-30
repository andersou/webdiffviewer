# webdiffviewer

A git diff viewer for the browser, in the style of VS Code's Source Control panel. The backend is Go and the UI is SolidJS, shipped as a single binary.

Run `webdiffviewer` in any folder and open your browser. It finds the repository and its submodules and shows branches, worktrees, the file tree, the changes tree and the commit graph, with syntax-highlighted diffs and a markdown preview modeled on [Markdown Preview Enhanced](https://github.com/shd101wyy/vscode-markdown-preview-enhanced).

![Changes tab with a syntax-highlighted diff](docs/screenshots/diff.png)

## Screenshots

**Markdown preview:** YAML frontmatter as a table, table of contents, alerts, mermaid diagrams, KaTeX math. It has light and dark themes.

| GitHub Light | GitHub Dark |
|---|---|
| ![Markdown preview, light theme, with frontmatter table and TOC](docs/screenshots/markdown.png) | ![Markdown preview, dark theme, with mermaid diagram and KaTeX](docs/screenshots/markdown-dark.png) |

**Commit graph:** branches, merges and tags. Opening a commit shows its message and changed files, and each file opens as a diff at that commit.

![Commits tab with the branch graph and a merge commit open](docs/screenshots/commits.png)

**Repository picker:** with `-parent-dir`, Ctrl/⌘+K opens a fuzzy search over every repo in that folder.

![Repository picker with fuzzy search](docs/screenshots/picker.png)

**Mobile:** on a phone you see the list or the open file. **←** goes back to the list, and swiping right-to-left on the list returns to the file.

<p>
  <img src="docs/screenshots/mobile-list.png" alt="Changes list on a phone" width="260" />
  <img src="docs/screenshots/mobile-diff.png" alt="Diff on a phone" width="260" />
</p>

## Features

- **Repositories:** the repo that contains the folder, plus every repo and submodule below it, with their worktrees. The scan goes 6 levels deep and skips `node_modules` and hidden folders.
- **Branches:** switch branches with `git switch`. Picking a remote branch creates the local tracking branch.
- **Changes:** staged and unstaged changes as a tree, with status letters (M, A, D, R, U).
- **Explorer:** the tree of tracked and untracked files, with each file's status.
- **Commits:** history with a branch/merge graph and branch/tag badges, for the current branch or **All branches**, 300 commits at a time. Merges are diffed against their first parent. Details are cached and prefetched on hover, so a commit opens almost instantly.
- **Base:** diff against another branch from the merge-base, like a pull request. The **Working tree** switch adds uncommitted and untracked changes; a **•** marks files with local edits. Turn it off to see only the branch's commits.
- **Views:** **Diff | File | Preview** in the top bar. *File* shows the whole file at the right version: the index for staged changes, `HEAD` for a branch comparison without the working tree, the commit in the Commits tab, otherwise the file on disk. Line-number columns that no row uses are hidden.
- **Syntax highlighting:** highlight.js with the tokyo-night theme, for files and diffs up to 512KB.
- **Icons:** [Material Icon Theme](https://github.com/material-extensions/vscode-material-icon-theme) (MIT) icons for files and folders, resolved the way VS Code does. The browser downloads only the icons on screen.
- **Markdown preview:** markdown-it with the same plugins as MPE:
  - YAML frontmatter as a table, `[TOC]`, footnotes, emoji, sub/sup, `==mark==`, abbreviations, definition lists and task lists;
  - KaTeX math (`$...$` and `$$...$$`), GitHub alerts (`> [!NOTE]`) and admonitions (`!!! tip`, collapsible `???`);
  - mermaid and Graphviz (```` ```dot ````) diagrams;
  - GitHub Light (default), Dark and Dark Dimmed themes;
  - relative images load from the repo, and relative links open inside the viewer;
  - a **TOC** panel next to the preview (an overlay on phones) that highlights the visible section.
- **Other repositories (`-parent-dir`):** the 📁 button and **Ctrl/⌘+K** open the fuzzy picker. The open repo lives in the URL (`?root=`), so each tab can show a different one.
- **Responsive:** up to 768px wide, the UI shows one pane at a time.
- **Refresh:** reloads when the window gains focus, or with the refresh button.

## Install

Download the binary for your platform from [Releases](https://github.com/andersou/webdiffviewer/releases): Linux, Windows and macOS, each for x64 and arm64. Every release includes `SHA256SUMS` to verify the downloads. You only need `git` installed.

```sh
# example: macOS on Apple Silicon
curl -LO https://github.com/andersou/webdiffviewer/releases/latest/download/SHA256SUMS
# download webdiffviewer-<version>-darwin-arm64.tar.gz from the release page, then:
shasum -a 256 -c SHA256SUMS --ignore-missing
tar -xzf webdiffviewer-*-darwin-arm64.tar.gz && ./webdiffviewer -version
```

### Build from source

Requires Go 1.24+, Node 20+ and git.

```sh
git clone https://github.com/andersou/webdiffviewer.git
cd webdiffviewer
make build      # installs dependencies, builds the frontend, compiles ./webdiffviewer
make install    # optional: copies it to $GOPATH/bin
```

The frontend is embedded in the binary (`go:embed`), so `go build` needs `web/dist`, which only exists after `make build`.

## Usage

```sh
cd /some/repo
webdiffviewer                                # http://127.0.0.1:8080
webdiffviewer -port 9000 ../other-folder     # another folder and port
webdiffviewer -parent-dir ~/git              # Ctrl/⌘+K opens any repo in ~/git
webdiffviewer -host 0.0.0.0                  # reachable on the network (see Security)
```

| Flag | Default | Description |
|---|---|---|
| `-host` | `127.0.0.1` | Address to listen on |
| `-port` | `8080` | Port |
| `-parent-dir` | — | Folder whose repos the picker can open |
| `-version` | — | Print the version and exit |
| `[dir]` | `.` | Folder to start in |

## Security

- By default the server listens on loopback only and rejects requests with any other `Host` header, which blocks DNS rebinding.
- **There is no authentication.** With `-host 0.0.0.0`, anyone on the network can read the files and switch branches. With `-parent-dir`, that applies to every repo in that folder.
- The API rejects paths that leave the repo, through `..` or symlinks. `-parent-dir` also rejects folders outside it.
- Only hex commit ids are accepted, so refs and options can't be injected into git commands.
- Markdown HTML is sanitized with DOMPurify. Raw files (`/api/raw`) are served with `Content-Security-Policy: sandbox`.
- Branch switching requires a JSON body, so another website open in the browser can't trigger it.

## Development

```sh
go run . &                 # API on :8080 (needs web/dist: run make build once)
cd web && npm run dev      # Vite with hot reload; proxies /api to :8080
make test                  # Go and JS tests
```

### Releases

Releases are automatic: [semantic-release](https://github.com/semantic-release/semantic-release) reads commit messages in the [Conventional Commits](https://www.conventionalcommits.org/) format. `feat:` makes a minor release, `fix:` and `perf:` a patch release, and `!` or `BREAKING CHANGE` a major release. Other types (`docs:`, `ci:`, `chore:`…) don't make a release.

The `.github/workflows/ci-release.yml` workflow:
1. tests the project and builds the frontend once;
2. builds and tests the binary on native runners for all 6 targets, checking each binary's `-version`;
3. publishes the release with the archives and `SHA256SUMS`.

Pushing to `develop` publishes `-beta` pre-releases.

### Layout

```
main.go                  flags, embedded frontend, server startup
internal/git/            runs git and parses its output (status, diff, log, worktrees); no HTTP
internal/server/         HTTP API: routes and middleware, repos/branches, changes/files, commits
web/src/
  app/                   App: sidebar, repo/branch/base controls, tabs
  tree/                  file tree and Material Icon Theme lookup
  viewer/                Viewer (Diff | File | Preview), CodeView, diff parser, syntax highlighting
  markdown/              markdown engine (markdown-it plugins), preview + TOC, themes, admonitions, frontmatter
  commits/               Commits tab and the graph layout
  picker/                repository picker (-parent-dir)
  lib/                   API client and pure helpers (fuzzy search, link resolution)
  styles/                shared Panda CSS styles
```

Tests sit next to the code they cover (`*_test.go`, `*.test.js`). Styles use Panda CSS (`web/panda.config.ts`); `web/src/markdown/markdown.css` adjusts the HTML generated from markdown. `npm install` copies the icon SVGs to `web/public/icons` (`web/scripts/copy-icons.js`). Screenshots in `docs/screenshots` come from a made-up demo repository.

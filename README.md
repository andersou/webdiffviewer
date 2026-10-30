# webdiffviewer

Visualizador web de diffs git, no estilo do painel Source Control do VS Code. Backend em Go, interface em SolidJS, tudo num único binário.

Rode `webdiffviewer` dentro de qualquer pasta e abra o navegador: ele encontra o repositório e os submodules, mostra branches, worktrees, a árvore de arquivos e a árvore de alterações, com diff colorido e preview de Markdown no estilo do [Markdown Preview Enhanced](https://github.com/shd101wyy/vscode-markdown-preview-enhanced).

## Recursos

- **Repositórios:** o repo que contém a pasta e todos os repos e submodules abaixo dela (até 6 níveis; ignora `node_modules` e pastas ocultas), cada um com seus worktrees.
- **Branches:** troca de branch com `git switch`. Escolher uma branch remota cria a branch local de acompanhamento.
- **Changes:** alterações staged e não staged, em árvore, com as letras de status (M, A, D, R, U).
- **Explorer:** árvore de arquivos rastreados e não rastreados, com o status de cada um.
- **Compare:** diff contra outra branch, a partir do merge-base, como num pull request. O switch **Working tree** inclui alterações não commitadas e arquivos untracked (com **•** nos arquivos que têm alterações locais). Desligado, mostra só os commits da branch.
- **Visualização:** **Diff | File | Preview** na barra superior. *File* mostra o arquivo inteiro na versão certa: a do index para alterações staged, a do `HEAD` numa comparação sem working tree, e a da pasta nos outros casos.
- **Syntax highlight:** highlight.js com o tema tokyo-night, em arquivos e diffs de até 512KB.
- **Preview de Markdown:** markdown-it com os mesmos plugins do MPE:
  - frontmatter YAML em tabela, sumário com `[TOC]`, notas de rodapé, emoji, sub/sup, `==mark==`, abreviações, listas de definição e checklists;
  - fórmulas KaTeX (`$...$` e `$$...$$`), alertas do GitHub (`> [!NOTE]`) e admonitions (`!!! tip`, `???` recolhível);
  - diagramas mermaid e Graphviz (```` ```dot ````);
  - temas GitHub Light (padrão), Dark e Dark Dimmed;
  - imagens relativas carregam do repo, e links relativos abrem dentro do visualizador.
  - botão **TOC** com os títulos do documento ao lado do preview (por cima do texto no celular), destacando a seção visível.
- **Outros repos (`-parent-dir`):** o botão 📁 e o atalho **Ctrl/⌘+K** abrem um seletor com busca fuzzy dos repos dessa pasta. O repo aberto fica na URL (`?root=`), então cada aba pode olhar um repo diferente.
- **Responsivo:** em telas de até 768px mostra a lista ou o arquivo, com o botão ← para voltar.
- **Atualização:** recarrega ao focar a janela ou no botão ⟳.

## Instalação

Requer Go 1.24+, Node 20+ e git.

```sh
git clone https://github.com/andersou/webdiffviewer.git
cd webdiffviewer
make build      # instala dependências, gera o frontend e compila ./webdiffviewer
make install    # opcional: copia para $GOPATH/bin
```

O frontend é embutido no binário (`go:embed`). Por isso o `go build` precisa de `web/dist`, que só existe depois do `make build`.

## Uso

```sh
cd /algum/repo
webdiffviewer                                # http://127.0.0.1:8080
webdiffviewer -port 9000 ../outra-pasta      # outra pasta e porta
webdiffviewer -parent-dir ~/git              # Ctrl/⌘+K abre qualquer repo de ~/git
webdiffviewer -host 0.0.0.0                  # acessível na rede (veja Segurança)
```

| Flag | Padrão | Descrição |
|---|---|---|
| `-host` | `127.0.0.1` | Endereço em que o servidor escuta |
| `-port` | `8080` | Porta |
| `-parent-dir` | — | Pasta cujos repos podem ser abertos pelo seletor |
| `[dir]` | `.` | Pasta inicial |

## Segurança

- Por padrão o servidor escuta só em loopback e recusa requisições com outro `Host` (proteção contra DNS rebinding).
- **Não há autenticação.** Com `-host 0.0.0.0`, qualquer pessoa na rede consegue ler os arquivos e trocar de branch. Junto com `-parent-dir`, isso vale para todos os repos dessa pasta.
- A API recusa caminhos fora do repo, tanto com `..` quanto por symlink. O `-parent-dir` também recusa pastas fora dele.
- O HTML do Markdown passa pelo DOMPurify, e os arquivos crus (`/api/raw`) são servidos com `Content-Security-Policy: sandbox`.
- A troca de branch exige JSON no corpo da requisição, então outro site aberto no navegador não consegue dispará-la.

## Desenvolvimento

```sh
go run . &                 # API em :8080 (precisa de web/dist; rode make build uma vez)
cd web && npm run dev      # Vite com hot reload; faz proxy de /api para :8080
make test                  # testes Go + JS
```

Estrutura:

- `main.go`: flags, rotas e proteção de `Host`.
- `api.go`: handlers que chamam o `git` (status, diff, branches, worktrees, arquivos).
- `web/src`: componentes Solid (`App`, `Tree`, `Viewer`, `Picker`).
- `web/src/mdEngine.js`: o motor de Markdown.
- Estilos: Panda CSS (`web/panda.config.ts` e `web/src/ui.js`). `web/src/markdown.css` ajusta o HTML gerado pelo Markdown.

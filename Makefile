build:
	cd web && npm ci && npm run build
	go build -o webdiffviewer .

# go test needs web/dist (embedded), so it builds first
test: build
	go test ./...
	cd web && npm test

install: build
	go install .

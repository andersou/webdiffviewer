const conventionalCommits = {
  preset: "conventionalcommits",
  presetConfig: {},
};

// The first matching rule wins, so the breaking rule must precede the
// per-type rules; otherwise a breaking `feat` would only bump the minor.
const releaseRules = [
  { breaking: true, release: "major" },
  { type: "feat", release: "minor" },
  { type: "fix", release: "patch" },
  { type: "perf", release: "patch" },
  { type: "revert", release: "patch" },
  { type: "docs", release: false },
  { type: "chore", release: false },
  { type: "ci", release: false },
  { type: "test", release: false },
  { type: "refactor", release: false },
  { type: "style", release: false },
  { type: "build", release: false },
];

// Go has no manifest to bump: the version is stamped into the binary at build time
// (-ldflags "-X main.version=..."), so no release commit is needed.
export default {
  tagFormat: "v${version}",
  branches: [
    { name: "main" },
    { name: "develop", channel: "beta", prerelease: "beta" },
  ],
  plugins: [
    ["@semantic-release/commit-analyzer", { ...conventionalCommits, releaseRules }],
    ["@semantic-release/release-notes-generator", conventionalCommits],
    ["@semantic-release/exec", {
      verifyReleaseCmd: 'if [ -n "$EXPECTED_VERSION" ] && [ "$EXPECTED_VERSION" != "${nextRelease.version}" ]; then printf "%s\\n" "planned version $EXPECTED_VERSION does not match ${nextRelease.version}" >&2; exit 1; fi',
    }],
    ["@semantic-release/github", {
      assets: ["dist/*.tar.gz", "dist/*.zip", "dist/SHA256SUMS"],
      successComment: false,
      failComment: false,
      failTitle: false,
      labels: false,
      releasedLabels: false,
    }],
  ],
};

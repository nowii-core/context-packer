# ctx-pack

<p align="center">
  <b>Pack any codebase into one clean, LLM-ready prompt. Respects .gitignore, redacts secrets, estimates tokens. Zero dependencies.</b>
</p>

<p align="center">
  <a href="https://github.com/nowii-core/context-packer/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-007ec6?style=for-the-badge" alt="License">
  </a>
  <img src="https://img.shields.io/badge/Node.js-%E2%89%A518.3-3c873a?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Dependencies-0-success?style=for-the-badge" alt="Zero Dependencies">
  <img src="https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-000000?style=for-the-badge" alt="Platform">
</p>

<p align="center">
  <a href="#overview">Overview</a> |
  <a href="#key-features">Features</a> |
  <a href="#usage">Usage</a> |
  <a href="#library-usage">Library</a> |
  <a href="#what-gets-skipped">Security</a> |
  <a href="#development">Development</a> |
  <a href="#contact">Contact</a>
</p>

---

</div>

## Overview

You want to ask an AI about your project, but you end up copy-pasting twenty files, forgetting `node_modules`, and accidentally pasting a `.env`. **`ctx-pack` does it in one command.**

It scans your directory, respects your ignores, redacts secrets, and outputs a single, beautifully formatted Markdown document ready to be pasted into Claude, ChatGPT, Gemini, or any local model.

```bash
npx ctx-pack            # pack the current folder straight to your clipboard
```

```text
✔ ctx-pack · my-api
  files   42 packed · skipped 3 binary, 1 too large
  tokens  ~18,402 (73,608 chars, estimate)
  secrets 2 redacted (aws-access-key, credential)
  top     src/engine.js ~4,210 · src/router.js ~2,980 · README.md ~1,540
  output  clipboard
```

---

## Key Features

- **Built for Prompts:** Generates one single Markdown document containing a project tree and every file in a fenced, language-tagged block.
- **Secret-Safe:** `.env`, keys, and certificates are never read. API keys, tokens, and private keys found in code are replaced with `[REDACTED:...]`.
- **Token-Aware:** Shows an estimate and the heaviest files. The `--max-tokens` flag drops the biggest files until the output fits your model's context window.
- **Smart Ignores:** Honors every `.gitignore` (including nested ones), plus sane defaults: `node_modules`, `dist`, lockfiles, binaries, minified files.
- **Zero Dependencies:** Pure Node.js. No `npm install`, no supply chain, starts instantly.
- **Cross-Platform Clipboard:** Works on macOS, Windows, Linux (X11/Wayland), and WSL, using native tools.

---

## Quick Start

Requires Node.js 18.3 or newer.

```bash
# Run once without installing
npx ctx-pack

# Or install globally
npm install -g ctx-pack
```

**Prefer not to use the terminal?** 
- **Windows:** Drag a folder onto `pack-here.bat`.
- **macOS:** Double-click `pack-here.command` to pack the folder it sits in.
The result will land directly in your clipboard.

---

## Usage

```bash
ctx-pack [dir] [options]
```

### Examples

```bash
ctx-pack                               # current folder -> clipboard
ctx-pack ../api -o api.md              # another folder -> file
ctx-pack -i "src/**" -i "*.md"         # only these paths
ctx-pack -e "tests/" -e "*.svg"        # skip these
ctx-pack --max-tokens 50000            # fit a 50k-token budget
ctx-pack -f xml                        # XML tags (great for Claude)
ctx-pack --stdout | less               # pipe anywhere
```

### Options

| Option | Description |
| :--- | :--- |
| `-c, --copy` | Copy to the clipboard |
| `-o, --out <file>` | Write to a file |
| `--stdout` | Print to stdout |
| `-i, --include <glob>` | Only pack matching paths (repeatable) |
| `-e, --exclude <glob>` | Skip matching paths (repeatable) |
| `--max-size <kb>` | Skip files larger than this (default `200`) |
| `--max-tokens <n>` | Drop the largest files until the output fits |
| `--no-gitignore` | Ignore `.gitignore` files |
| `-f, --format <fmt>` | `md` (default), `xml`, or `plain` |
| `--no-tree` | Omit the directory tree |
| `--no-redact` | Disable secret redaction (not recommended) |
| `-q, --quiet` | No summary |

**Default behavior:** Outputs to clipboard when run in a terminal, and to stdout when piped. If no clipboard tool is available, it falls back to writing `context.md`. The summary goes to stderr, so piping stays clean. Exit codes: `0` ok, `1` nothing to pack/clipboard unavailable, `2` bad arguments.

---

## Library Usage

You can also use `ctx-pack` programmatically in your Node.js scripts:

```javascript
import { pack } from 'ctx-pack';

const { output, tokens, files, secrets } = await pack('./my-project', {
  format: 'md',
  include: ['src/**'],
  maxTokens: 30_000,
});
```

---

## What Gets Skipped & Security

To keep the output clean and secure, `ctx-pack` automatically skips:
- Everything matched by your `.gitignore` files.
- `.git`, `node_modules`, `dist`, `build`, `coverage`, `.next`, `venv`, `target`, and IDE folders.
- `.env*` (except `.env.example`), `*.pem`, `*.key`, SSH keys.
- Lockfiles, `*.min.js`, source maps.
- Binary files (by extension and content), files over `--max-size`, and empty files.
- Symlinks.

**Security Note:** Redaction is pattern-based (AWS, GitHub, Slack, Google, Stripe, OpenAI, Anthropic, JWTs, private key blocks, etc.). It is a safety net, **not an absolute guarantee**. Always skim the output before sharing proprietary code with a third-party model.

---

## Development

```bash
git clone https://github.com/nowii-core/context-packer.git
cd context-packer
npm test          # runs native node:test, no dependencies required
node bin/ctx-pack.js --help
```

### Roadmap
- [ ] `--diff` to pack only files changed in git.
- [ ] `--compress` to strip comments / collapse function bodies.
- [ ] Model-specific token counting.
- [ ] `--watch` to re-pack on change.

---

## License

This project is distributed under the **MIT** license. See the [`LICENSE`](./LICENSE) file for more information.

---

## Contact & Support

- **Maintainer:** [@nowii-core](https://github.com/nowii-core)
- **Repository:** [ctx-pack](https://github.com/nowii-core/context-packer)
- **Bug Reports & Feature Requests:** If you encounter an issue or would like to suggest an improvement, open an [Issue](https://github.com/nowii-core/context-packer/issues) or submit a [Pull Request](https://github.com/nowii-core/context-packer/pulls).

---

<div align="center">
  <sub>Developed by <b>nowii-core</b></sub>
</div>

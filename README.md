<div align="center">

# 📦 ctx-pack

**Pack any codebase into one clean, LLM-ready prompt.**
Respects `.gitignore` · redacts secrets · estimates tokens · **zero dependencies**

[![Node](https://img.shields.io/badge/node-%E2%89%A518.3-3c873a)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](package.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

</div>

---

You want to ask an AI about your project. You end up copy-pasting twenty files, forgetting `node_modules`, and
accidentally pasting a `.env`. **`ctx-pack` does it in one command.**

```bash
npx ctx-pack            # pack the current folder → straight to your clipboard
```

```
✔ ctx-pack · my-api
  files   42 packed · skipped 3 binary, 1 too large
  tokens  ~18,402 (73,608 chars, estimate)
  secrets 2 redacted (aws-access-key, credential)
  top     src/engine.js ~4,210 · src/router.js ~2,980 · README.md ~1,540
  output  clipboard
```

Paste into Claude, ChatGPT, Gemini, or any local model. Done.

## Why ctx-pack

| | |
|---|---|
| 🧠 **Built for prompts** | One Markdown document: project tree + every file in a fenced, language-tagged block. |
| 🔒 **Secret-safe** | `.env`, keys and certificates are never read. API keys, tokens and private keys found in code are replaced with `[REDACTED:…]`. |
| 🎯 **Token-aware** | Shows an estimate and the heaviest files. `--max-tokens` drops the biggest files until it fits your model's window. |
| 🙈 **Smart ignores** | Honors every `.gitignore` (nested too), plus sane defaults: `node_modules`, `dist`, lockfiles, binaries, minified files… |
| ⚡ **Zero dependencies** | Pure Node.js. No `npm install`, no supply chain, starts instantly. |
| 🖥️ **Cross-platform clipboard** | macOS, Windows, Linux (X11/Wayland) and WSL, using native tools. |

## Install

```bash
# no install — run once
npx ctx-pack

# or install globally
npm install -g ctx-pack
```

Requires Node.js 18.3 or newer. Prefer not to use npm? Clone the repo and run `node bin/ctx-pack.js`.

**Don't like the terminal?** Windows users can drag a folder onto `pack-here.bat`; macOS users can
double-click `pack-here.command` to pack the folder it sits in. The result lands in your clipboard.

## Usage

```bash
ctx-pack [dir] [options]
```

```bash
ctx-pack                               # current folder → clipboard
ctx-pack ../api -o api.md              # another folder → file
ctx-pack -i "src/**" -i "*.md"         # only these paths
ctx-pack -e "tests/" -e "*.svg"        # skip these
ctx-pack --max-tokens 50000            # fit a 50k-token budget
ctx-pack -f xml                        # XML tags (great for Claude)
ctx-pack --stdout | less               # pipe anywhere
```

| Option | Description |
|---|---|
| `-c, --copy` | Copy to the clipboard |
| `-o, --out <file>` | Write to a file |
| `--stdout` | Print to stdout |
| `-i, --include <glob>` | Only pack matching paths (repeatable) |
| `-e, --exclude <glob>` | Skip matching paths (repeatable) |
| `--max-size <kb>` | Skip files larger than this (default `200`) |
| `--max-tokens <n>` | Drop the largest files until the output fits |
| `--no-gitignore` | Ignore `.gitignore` files |
| `-f, --format <fmt>` | `md` (default), `xml` or `plain` |
| `--no-tree` | Omit the directory tree |
| `--no-redact` | Disable secret redaction (not recommended) |
| `-q, --quiet` | No summary |

**Default output:** clipboard when run in a terminal, stdout when piped. If no clipboard tool is available,
it falls back to writing `context.md`. The summary goes to stderr, so piping stays clean.

Exit codes: `0` ok · `1` nothing to pack / clipboard unavailable · `2` bad arguments.

## Use it as a library

```js
import { pack } from 'ctx-pack';

const { output, tokens, files, secrets } = await pack('./my-project', {
  format: 'md',
  include: ['src/**'],
  maxTokens: 30_000,
});
```

## What gets skipped

- Everything matched by your `.gitignore` files
- `.git`, `node_modules`, `dist`, `build`, `coverage`, `.next`, `venv`, `target`, IDE folders
- `.env*` (except `.env.example`), `*.pem`, `*.key`, SSH keys
- Lockfiles, `*.min.js`, source maps
- Binary files (by extension and by content), files over `--max-size`, empty files
- Symlinks

## Security notes

Redaction is pattern-based (AWS, GitHub, Slack, Google, Stripe, OpenAI and Anthropic keys, JWTs, private key
blocks, and `password/secret/token = "…"` assignments). It is a safety net, **not a guarantee** — always skim
the output before sharing proprietary code with a third-party model.

## Development

```bash
git clone https://github.com/nowii-core/context-packer
cd context-packer
npm test          # node:test, no dependencies
node bin/ctx-pack.js --help
```

## Roadmap

- [ ] `--diff` to pack only files changed in git
- [ ] `--compress` to strip comments / collapse function bodies
- [ ] Model-specific token counting
- [ ] `--watch` to re-pack on change

## License

MIT © [nowii](https://github.com/nowii-core)

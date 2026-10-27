import { parseArgs } from 'node:util';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pack } from './pack.js';
import { copyToClipboard } from './clipboard.js';
import { formatNumber } from './tokens.js';

const HELP = `
ctx-pack — pack a codebase into one LLM-ready prompt

USAGE
  ctx-pack [dir] [options]

OUTPUT (default: copy to clipboard in a terminal, print to stdout when piped)
  -c, --copy            copy to the clipboard
  -o, --out <file>      write to a file
      --stdout          print to stdout

SELECTION
  -i, --include <glob>  only pack matching paths (repeatable)  e.g. -i "src/**" -i "*.md"
  -e, --exclude <glob>  skip matching paths (repeatable)       e.g. -e "tests/" -e "*.svg"
      --max-size <kb>   skip files larger than this (default 200)
      --max-tokens <n>  drop the largest files until the output fits in n tokens
      --no-gitignore    don't read .gitignore files

FORMAT
  -f, --format <fmt>    md (default) | xml | plain
      --no-tree         omit the directory tree
      --no-redact       disable secret redaction (not recommended)

OTHER
  -q, --quiet           no summary
  -h, --help            show this help
  -v, --version         show version

EXAMPLES
  npx ctx-pack                      pack the current folder → clipboard
  ctx-pack ../api -o api.md         pack another folder into a file
  ctx-pack -i "src/**" --max-tokens 50000 --stdout | pbcopy
`;

const OPTIONS = {
  copy: { type: 'boolean', short: 'c' },
  out: { type: 'string', short: 'o' },
  stdout: { type: 'boolean' },
  include: { type: 'string', short: 'i', multiple: true },
  exclude: { type: 'string', short: 'e', multiple: true },
  'max-size': { type: 'string' },
  'max-tokens': { type: 'string' },
  'no-gitignore': { type: 'boolean' },
  format: { type: 'string', short: 'f' },
  'no-tree': { type: 'boolean' },
  'no-redact': { type: 'boolean' },
  quiet: { type: 'boolean', short: 'q' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
};

const useColor = process.stderr.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const dim = (s) => c(2, s);
const bold = (s) => c(1, s);
const green = (s) => c(32, s);
const yellow = (s) => c(33, s);
const cyan = (s) => c(36, s);

async function readVersion() {
  const pkg = await fs.readFile(new URL('../package.json', import.meta.url), 'utf8');
  return JSON.parse(pkg).version;
}

function positiveInt(value, flag) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${flag} expects a positive number, got "${value}"`);
  return n;
}

export async function main(argv) {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true });
  } catch (err) {
    console.error(`ctx-pack: ${err.message}\nTry "ctx-pack --help".`);
    return 2;
  }
  const { values: v, positionals } = parsed;

  if (v.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (v.version) {
    console.log(await readVersion());
    return 0;
  }

  const dir = positionals[0] || '.';
  try {
    const st = await fs.stat(dir);
    if (!st.isDirectory()) throw new Error('not a directory');
  } catch {
    console.error(`ctx-pack: cannot read directory "${dir}"`);
    return 2;
  }

  const format = v.format || 'md';
  if (!['md', 'xml', 'plain'].includes(format)) {
    console.error(`ctx-pack: unknown format "${format}" (use md, xml or plain)`);
    return 2;
  }

  let maxSize, maxTokens;
  try {
    maxSize = v['max-size'] ? positiveInt(v['max-size'], '--max-size') * 1024 : undefined;
    maxTokens = v['max-tokens'] ? positiveInt(v['max-tokens'], '--max-tokens') : undefined;
  } catch (err) {
    console.error(`ctx-pack: ${err.message}`);
    return 2;
  }

  const result = await pack(dir, {
    format,
    tree: !v['no-tree'],
    gitignore: !v['no-gitignore'],
    redact: !v['no-redact'],
    include: v.include || [],
    exclude: v.exclude || [],
    maxSize,
    maxTokens,
  });

  if (result.files.length === 0) {
    console.error('ctx-pack: nothing to pack (no text files matched).');
    return 1;
  }

  // ---- deliver output ----
  const destinations = [];
  const wantsExplicit = v.out || v.stdout || v.copy;

  if (v.out) {
    await fs.mkdir(path.dirname(path.resolve(v.out)), { recursive: true });
    await fs.writeFile(v.out, result.output, 'utf8');
    destinations.push(`file ${v.out}`);
  }
  if (v.stdout || (!wantsExplicit && !process.stdout.isTTY)) {
    process.stdout.write(result.output);
    destinations.push('stdout');
  }
  if (v.copy || (!wantsExplicit && process.stdout.isTTY)) {
    if (await copyToClipboard(result.output)) {
      destinations.push('clipboard');
    } else if (v.copy) {
      console.error('ctx-pack: no clipboard tool found (install xclip, xsel or wl-clipboard). Use --out or --stdout.');
      return 1;
    } else {
      await fs.writeFile('context.md', result.output, 'utf8');
      destinations.push('file context.md (clipboard unavailable)');
    }
  }

  // ---- summary (stderr, so piping stays clean) ----
  if (!v.quiet) {
    const bins = result.skipped.filter((s) => s.reason === 'binary').length;
    const big = result.skipped.filter((s) => s.reason === 'too-large').length;
    const skippedBits = [bins && `${bins} binary`, big && `${big} too large`].filter(Boolean).join(', ');
    const top = [...result.files].sort((a, b) => b.tokens - a.tokens).slice(0, 3);

    const lines = [
      `${green('✔')} ${bold('ctx-pack')} ${dim('·')} ${result.name}`,
      `  ${dim('files  ')} ${formatNumber(result.files.length)} packed${skippedBits ? dim(` · skipped ${skippedBits}`) : ''}`,
      `  ${dim('tokens ')} ${cyan('~' + formatNumber(result.tokens))} ${dim(`(${formatNumber(result.chars)} chars, estimate)`)}`,
    ];
    if (result.secrets) {
      lines.push(`  ${dim('secrets')} ${yellow(`${result.secrets} redacted`)} ${dim(`(${result.secretTypes.join(', ')})`)}`);
    }
    if (result.dropped.length) {
      lines.push(`  ${dim('budget ')} ${yellow(`dropped ${result.dropped.length} largest file(s) to fit ${formatNumber(maxTokens)} tokens`)}`);
      for (const d of result.dropped.slice(0, 3)) lines.push(`  ${dim('        ')} ${dim('- ' + d.rel + ' (~' + formatNumber(d.tokens) + ')')}`);
    }
    lines.push(`  ${dim('top    ')} ${top.map((f) => `${f.rel} ${dim('~' + formatNumber(f.tokens))}`).join(dim(' · '))}`);
    lines.push(`  ${dim('output ')} ${destinations.join(', ')}`);
    console.error(lines.join('\n'));
  }
  return 0;
}

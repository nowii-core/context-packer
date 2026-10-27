import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pack } from '../src/pack.js';
import { redactSecrets } from '../src/redact.js';
import { renderTree } from '../src/format.js';

function fixture() {
  const dir = mkdtempSync(path.join(tmpdir(), 'ctxpack-'));
  const w = (rel, content) => {
    const abs = path.join(dir, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  };
  w('index.js', 'console.log("hi");\n');
  w('src/util.js', 'export const x = 1;\n');
  w('README.md', '# Demo\n');
  w('node_modules/lib/a.js', 'ignored');
  w('.git/config', 'ignored');
  w('.env', 'TOKEN=supersecretvalue123');
  w('.gitignore', 'secret/\n*.log\n');
  w('secret/key.txt', 'nope');
  w('app.log', 'noise');
  w('logo.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0]));
  w('data.bin.txt', Buffer.from([65, 0, 66, 0]));
  w('big.txt', 'a'.repeat(300 * 1024));
  return dir;
}

test('packs text files and respects ignores', async () => {
  const dir = fixture();
  try {
    const r = await pack(dir, { date: '2026-01-01' });
    const rels = r.files.map((f) => f.rel).sort();
    assert.deepEqual(rels, ['.gitignore', 'README.md', 'index.js', 'src/util.js']);
    assert.ok(r.skipped.some((s) => s.rel === 'big.txt' && s.reason === 'too-large'));
    assert.ok(r.skipped.some((s) => s.rel === 'logo.png' && s.reason === 'binary'));
    assert.ok(r.skipped.some((s) => s.rel === 'data.bin.txt' && s.reason === 'binary'));
    assert.match(r.output, /### `src\/util\.js`/);
    assert.match(r.output, /```javascript/);
    assert.ok(r.tokens > 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('--include and --exclude', async () => {
  const dir = fixture();
  try {
    const a = await pack(dir, { include: ['src/**'] });
    assert.deepEqual(a.files.map((f) => f.rel), ['src/util.js']);
    const b = await pack(dir, { exclude: ['*.md'] });
    assert.ok(!b.files.some((f) => f.rel === 'README.md'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('max-tokens drops the largest files first', async () => {
  const dir = fixture();
  try {
    writeFileSync(path.join(dir, 'huge.js'), 'const a = 1;\n'.repeat(2000));
    const r = await pack(dir, { maxTokens: 500 });
    assert.ok(r.dropped.some((d) => d.rel === 'huge.js'));
    assert.ok(r.tokens <= 500);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('xml and plain formats', async () => {
  const dir = fixture();
  try {
    const x = await pack(dir, { format: 'xml' });
    assert.match(x.output, /<file path="index\.js"/);
    const p = await pack(dir, { format: 'plain', tree: false });
    assert.match(p.output, /===== index\.js =====/);
    assert.ok(!p.output.includes('├──'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('markdown fences grow when content contains backticks', async () => {
  const dir = fixture();
  try {
    writeFileSync(path.join(dir, 'doc.md'), 'Example:\n```js\nx()\n```\n');
    const r = await pack(dir);
    assert.match(r.output, /````markdown/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('redacts secrets', () => {
  const src = [
    'const k = "AKIAIOSFODNN7EXAMPLE";',
    'const t = "ghp_' + 'a'.repeat(36) + '";',
    'password = "hunter2hunter2"',
    '-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----',
    'api_key = "your_api_key_here"',
  ].join('\n');
  const r = redactSecrets(src);
  assert.equal(r.count, 4);
  assert.ok(!r.text.includes('AKIAIOSFODNN7EXAMPLE'));
  assert.ok(!r.text.includes('hunter2hunter2'));
  assert.ok(r.text.includes('your_api_key_here')); // placeholders are kept
});

test('tree rendering', () => {
  const t = renderTree(['a/b.js', 'a/c.js', 'z.md'], 'proj');
  assert.equal(t, ['proj/', '├── a/', '│   ├── b.js', '│   └── c.js', '└── z.md'].join('\n'));
});

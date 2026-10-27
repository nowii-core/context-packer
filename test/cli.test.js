import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const BIN = path.resolve('bin/ctx-pack.js');
const run = (args, opts = {}) => spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8', ...opts });

test('--help and --version', () => {
  assert.match(run(['--help']).stdout, /USAGE/);
  assert.match(run(['--version']).stdout.trim(), /^\d+\.\d+\.\d+$/);
});

test('unknown flag exits with code 2', () => {
  const r = run(['--nope']);
  assert.equal(r.status, 2);
});

test('piped output goes to stdout; summary goes to stderr', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ctxcli-'));
  try {
    writeFileSync(path.join(dir, 'a.js'), 'let a = 1;\n');
    const r = run([dir]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /### `a\.js`/);
    assert.match(r.stderr, /tokens/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('--out writes a file, --quiet silences the summary', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ctxcli-'));
  try {
    writeFileSync(path.join(dir, 'a.js'), 'let a = 1;\n');
    const out = path.join(dir, 'out', 'packed.md');
    const r = run([dir, '-o', out, '-q']);
    assert.equal(r.status, 0);
    assert.equal(r.stderr, '');
    assert.match(readFileSync(out, 'utf8'), /let a = 1;/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('empty folder exits with code 1', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ctxcli-'));
  try {
    assert.equal(run([dir]).status, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

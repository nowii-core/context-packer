import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ignore } from '../src/ignore.js';

test('simple name matches at any depth', () => {
  const ig = new Ignore().add('node_modules\n*.log');
  assert.ok(ig.ignores('node_modules', true));
  assert.ok(ig.ignores('a/b/node_modules', true));
  assert.ok(ig.ignores('debug.log'));
  assert.ok(ig.ignores('x/y/debug.log'));
  assert.ok(!ig.ignores('src/index.js'));
});

test('directory-only patterns do not match files', () => {
  const ig = new Ignore().add('build/');
  assert.ok(ig.ignores('build', true));
  assert.ok(!ig.ignores('build', false));
});

test('anchored patterns', () => {
  const ig = new Ignore().add('/todo.txt\ndocs/internal');
  assert.ok(ig.ignores('todo.txt'));
  assert.ok(!ig.ignores('src/todo.txt'));
  assert.ok(ig.ignores('docs/internal', true));
  assert.ok(!ig.ignores('x/docs/internal', true));
});

test('negation: last match wins', () => {
  const ig = new Ignore().add('*.env\n!public.env');
  assert.ok(ig.ignores('secret.env'));
  assert.ok(!ig.ignores('public.env'));
});

test('double star', () => {
  const ig = new Ignore().add('src/**/gen\nlogs/**');
  assert.ok(ig.ignores('src/gen', true));
  assert.ok(ig.ignores('src/a/b/gen', true));
  assert.ok(ig.ignores('logs/a.txt'));
  assert.ok(!ig.ignores('other/gen', true));
});

test('nested gitignore base', () => {
  const ig = new Ignore().add('*.tmp', 'pkg/');
  assert.ok(ig.ignores('pkg/a.tmp'));
  assert.ok(ig.ignores('pkg/deep/a.tmp'));
  assert.ok(!ig.ignores('a.tmp'));
});

test('comments and blank lines are ignored', () => {
  const ig = new Ignore().add('# comment\n\n   \nfoo');
  assert.equal(ig.rules.length, 1);
});

test('matchesWithAncestors (used by --include)', () => {
  const ig = new Ignore().add('src');
  assert.ok(ig.matchesWithAncestors('src/a/b.js'));
  assert.ok(!ig.matchesWithAncestors('lib/a.js'));
});

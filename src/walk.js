import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Ignore } from './ignore.js';

/** Always skipped (gitignore syntax). Last match wins, so "!" entries re-allow files. */
export const DEFAULT_IGNORE = [
  // VCS / tooling / build output
  '.git/', '.svn/', '.hg/', 'node_modules/', 'dist/', 'build/', 'out/', 'coverage/',
  '.next/', '.nuxt/', '.svelte-kit/', '.turbo/', '.cache/', '.parcel-cache/',
  '__pycache__/', '.venv/', 'venv/', 'target/', '.gradle/',
  '.idea/', '.vscode/', '.DS_Store', 'Thumbs.db',
  // secrets
  '.env', '.env.*', '!.env.example', '!.env.sample', '!.env.template',
  '*.pem', '*.key', '*.p12', '*.pfx', 'id_rsa', 'id_ed25519', '*.keystore',
  // noise
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', 'Cargo.lock',
  'poetry.lock', 'composer.lock', 'Gemfile.lock', '*.min.js', '*.min.css', '*.map',
];

const BINARY_EXT = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'icns', 'tiff', 'psd', 'svgz',
  'mp3', 'wav', 'ogg', 'flac', 'mp4', 'mov', 'avi', 'mkv', 'webm',
  'zip', 'gz', 'tar', 'tgz', 'bz2', 'xz', '7z', 'rar', 'jar', 'war',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'exe', 'dll', 'so', 'dylib', 'bin', 'o', 'a', 'class', 'pyc', 'wasm',
  'ttf', 'otf', 'woff', 'woff2', 'eot', 'sqlite', 'db', 'glb', 'gltf', 'obj', 'fbx',
]);

const toPosix = (p) => p.split(path.sep).join('/');

function looksBinary(buf) {
  const len = Math.min(buf.length, 8000);
  for (let i = 0; i < len; i++) if (buf[i] === 0) return true;
  return false;
}

/**
 * Walk a directory and collect text files to pack.
 * @param {string} root
 * @param {{ gitignore?: boolean, include?: string[], exclude?: string[], maxSize?: number }} opts
 *        maxSize is in bytes.
 * @returns {Promise<{ files: {rel:string,size:number,content:string}[], skipped: {rel:string,reason:string}[] }>}
 */
export async function collect(root, opts = {}) {
  const { gitignore = true, include = [], exclude = [], maxSize = 200 * 1024 } = opts;

  const ignore = new Ignore().add(DEFAULT_IGNORE);
  if (exclude.length) ignore.add(exclude);
  const inc = include.length ? new Ignore().add(include) : null;

  const files = [];
  const skipped = [];

  async function loadGitignore(dirAbs, relDir) {
    if (!gitignore) return;
    try {
      const txt = await fs.readFile(path.join(dirAbs, '.gitignore'), 'utf8');
      ignore.add(txt, relDir ? relDir + '/' : '');
    } catch {
      /* no .gitignore here */
    }
  }

  async function walk(dirAbs, relDir) {
    await loadGitignore(dirAbs, relDir);
    let entries;
    try {
      entries = await fs.readdir(dirAbs, { withFileTypes: true });
    } catch {
      skipped.push({ rel: relDir || '.', reason: 'unreadable' });
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue; // avoid loops and escaping the root
      const rel = relDir ? relDir + '/' + entry.name : entry.name;
      const abs = path.join(dirAbs, entry.name);

      if (entry.isDirectory()) {
        if (ignore.ignores(rel, true)) continue;
        await walk(abs, rel);
        continue;
      }
      if (!entry.isFile()) continue;
      if (ignore.ignores(rel, false)) continue;
      if (inc && !inc.matchesWithAncestors(rel)) continue;

      const ext = path.extname(entry.name).slice(1).toLowerCase();
      if (BINARY_EXT.has(ext)) {
        skipped.push({ rel, reason: 'binary' });
        continue;
      }
      let stat;
      try {
        stat = await fs.stat(abs);
      } catch {
        skipped.push({ rel, reason: 'unreadable' });
        continue;
      }
      if (stat.size > maxSize) {
        skipped.push({ rel, reason: 'too-large' });
        continue;
      }
      let buf;
      try {
        buf = await fs.readFile(abs);
      } catch {
        skipped.push({ rel, reason: 'unreadable' });
        continue;
      }
      if (looksBinary(buf)) {
        skipped.push({ rel, reason: 'binary' });
        continue;
      }
      let content = buf.toString('utf8');
      if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);
      if (!content.trim()) {
        skipped.push({ rel, reason: 'empty' });
        continue;
      }
      files.push({ rel: toPosix(rel), size: stat.size, content });
    }
  }

  await walk(path.resolve(root), '');
  return { files, skipped };
}

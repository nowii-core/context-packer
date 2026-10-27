import path from 'node:path';
import { collect } from './walk.js';
import { render } from './format.js';
import { redactSecrets } from './redact.js';
import { estimateTokens } from './tokens.js';

/**
 * Pack a directory into one LLM-ready document.
 * @param {string} dir
 * @param {{
 *   format?: 'md'|'xml'|'plain', tree?: boolean, gitignore?: boolean, redact?: boolean,
 *   include?: string[], exclude?: string[], maxSize?: number, maxTokens?: number, date?: string
 * }} opts
 */
export async function pack(dir, opts = {}) {
  const root = path.resolve(dir);
  const name = path.basename(root) || 'project';
  const { files: raw, skipped } = await collect(root, opts);

  let secrets = 0;
  const secretTypes = new Set();
  let files = raw.map((f) => {
    if (opts.redact === false) return { ...f, tokens: estimateTokens(f.content) };
    const r = redactSecrets(f.content);
    secrets += r.count;
    r.types.forEach((t) => secretTypes.add(t));
    return { ...f, content: r.text, tokens: estimateTokens(r.text) };
  });

  const fmt = { name, format: opts.format, tree: opts.tree, date: opts.date };
  let output = render(files, fmt);
  const dropped = [];

  // Fit into a token budget by dropping the largest files first.
  if (opts.maxTokens && estimateTokens(output) > opts.maxTokens) {
    const bySize = [...files].sort((a, b) => b.tokens - a.tokens);
    const gone = new Set();
    for (const f of bySize) {
      if (estimateTokens(output) <= opts.maxTokens) break;
      gone.add(f.rel);
      dropped.push({ rel: f.rel, tokens: f.tokens });
      files = files.filter((x) => !gone.has(x.rel));
      output = render(files, fmt);
    }
  }

  return {
    name,
    output,
    files,
    skipped,
    dropped,
    secrets,
    secretTypes: [...secretTypes],
    tokens: estimateTokens(output),
    chars: output.length,
  };
}

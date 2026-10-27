import { estimateTokens, formatNumber } from './tokens.js';

const LANG = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java', kt: 'kotlin', swift: 'swift',
  c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', cs: 'csharp', php: 'php', lua: 'lua', dart: 'dart',
  sh: 'bash', bash: 'bash', zsh: 'bash', ps1: 'powershell', bat: 'batch',
  html: 'html', css: 'css', scss: 'scss', vue: 'vue', svelte: 'svelte',
  json: 'json', yml: 'yaml', yaml: 'yaml', toml: 'toml', xml: 'xml', sql: 'sql',
  md: 'markdown', glsl: 'glsl', wgsl: 'wgsl', tf: 'hcl', dockerfile: 'dockerfile',
};

export function languageOf(rel) {
  const name = rel.split('/').pop().toLowerCase();
  if (name === 'dockerfile') return 'dockerfile';
  if (name === 'makefile') return 'makefile';
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : LANG[name.slice(dot + 1)] || '';
}

/** ASCII tree of the packed files. */
export function renderTree(rels, rootName) {
  const root = {};
  for (const rel of rels) {
    let node = root;
    for (const seg of rel.split('/')) node = node[seg] ??= {};
  }
  const lines = [rootName + '/'];
  const walk = (node, prefix) => {
    const names = Object.keys(node).sort((a, b) => {
      const da = Object.keys(node[a]).length > 0;
      const db = Object.keys(node[b]).length > 0;
      if (da !== db) return da ? -1 : 1; // directories first
      return a < b ? -1 : a > b ? 1 : 0;
    });
    names.forEach((name, i) => {
      const last = i === names.length - 1;
      const isDir = Object.keys(node[name]).length > 0;
      lines.push(prefix + (last ? '└── ' : '├── ') + name + (isDir ? '/' : ''));
      if (isDir) walk(node[name], prefix + (last ? '    ' : '│   '));
    });
  };
  walk(root, '');
  return lines.join('\n');
}

function fenceFor(content) {
  const runs = content.match(/`+/g);
  const longest = runs ? Math.max(...runs.map((r) => r.length)) : 0;
  return '`'.repeat(Math.max(3, longest + 1));
}

/**
 * @param {{rel:string, content:string}[]} files
 * @param {{ name:string, format?:'md'|'xml'|'plain', tree?:boolean, date?:string }} opts
 */
export function render(files, opts) {
  const { name, format = 'md', tree = true, date = new Date().toISOString().slice(0, 10) } = opts;
  const treeText = tree ? renderTree(files.map((f) => f.rel), name) : '';
  const totalTokens = files.reduce((n, f) => n + estimateTokens(f.content), 0);
  const meta = `${files.length} files · ~${formatNumber(totalTokens)} tokens · ${date}`;

  if (format === 'xml') {
    const parts = [`<context project="${name}" files="${files.length}">`];
    if (tree) parts.push('<structure>', treeText, '</structure>');
    for (const f of files) {
      parts.push(`<file path="${f.rel}" tokens="${estimateTokens(f.content)}">`, f.content.replace(/\n$/, ''), '</file>');
    }
    parts.push('</context>');
    return parts.join('\n') + '\n';
  }

  if (format === 'plain') {
    const parts = [`PROJECT: ${name}`, meta, ''];
    if (tree) parts.push(treeText, '');
    for (const f of files) parts.push(`===== ${f.rel} =====`, f.content.replace(/\n$/, ''), '');
    return parts.join('\n');
  }

  const parts = [`# ${name}`, '', `> Packed with ctx-pack · ${meta}`, ''];
  if (tree) parts.push('## Structure', '', '```text', treeText, '```', '');
  parts.push('## Files', '');
  for (const f of files) {
    const fence = fenceFor(f.content);
    parts.push(`### \`${f.rel}\``, '', fence + languageOf(f.rel), f.content.replace(/\n$/, ''), fence, '');
  }
  return parts.join('\n');
}

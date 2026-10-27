// Minimal, dependency-free implementation of .gitignore semantics.
// Supported: comments, negation (!), anchored patterns (/foo, foo/bar),
// directory-only patterns (foo/), *, ?, [abc], ** and escaped characters.
// Rules are evaluated in order and the last matching rule wins.

const escapeRe = (s) => s.replace(/[.+^${}()|\\]/g, '\\$&');

/** Convert a glob (without the leading/trailing slash logic) to a regex source. */
export function globToRegexSource(glob) {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        const atSegmentStart = i === 0 || glob[i - 1] === '/';
        if (atSegmentStart && glob[i + 2] === '/') {
          out += '(?:.*/)?'; // "**/" matches zero or more directories
          i += 2;
        } else if (atSegmentStart && i + 2 >= glob.length) {
          out += '.*'; // trailing "/**" matches everything inside
          i += 1;
        } else {
          out += '[^/]*';
          i += 1;
        }
      } else {
        out += '[^/]*';
      }
    } else if (c === '?') {
      out += '[^/]';
    } else if (c === '[') {
      const end = glob.indexOf(']', i + 2);
      if (end === -1) {
        out += '\\[';
      } else {
        let cls = glob.slice(i + 1, end);
        if (cls[0] === '!') cls = '^' + cls.slice(1);
        out += '[' + cls.replace(/\\/g, '\\\\') + ']';
        i = end;
      }
    } else if (c === '\\' && i + 1 < glob.length) {
      out += escapeRe(glob[++i]);
    } else {
      out += escapeRe(c);
    }
  }
  return out;
}

function compileRule(line, base) {
  let p = line.replace(/\r$/, '');
  if (!p || p.startsWith('#')) return null;
  p = p.replace(/(?<!\\)\s+$/, '');
  if (!p) return null;

  let negate = false;
  if (p.startsWith('!')) {
    negate = true;
    p = p.slice(1);
  } else if (p.startsWith('\\!') || p.startsWith('\\#')) {
    p = p.slice(1);
  }

  let dirOnly = false;
  if (p.endsWith('/')) {
    dirOnly = true;
    p = p.slice(0, -1);
  }
  if (!p) return null;

  const anchored = p.includes('/');
  if (p.startsWith('/')) p = p.slice(1);

  const re = new RegExp(
    '^' + escapeRe(base) + (anchored ? '' : '(?:.*/)?') + globToRegexSource(p) + '$'
  );
  return { re, negate, dirOnly };
}

export class Ignore {
  constructor() {
    this.rules = [];
  }

  /**
   * Add rules.
   * @param {string|string[]} lines  patterns (a string is split on newlines)
   * @param {string} base            posix directory the patterns are relative to, e.g. "src/"
   */
  add(lines, base = '') {
    const list = Array.isArray(lines) ? lines : String(lines).split('\n');
    for (const line of list) {
      const rule = compileRule(line, base);
      if (rule) this.rules.push(rule);
    }
    return this;
  }

  /** @param {string} rel posix path relative to the root */
  ignores(rel, isDir = false) {
    let result = false;
    for (const r of this.rules) {
      if (r.dirOnly && !isDir) continue;
      if (r.re.test(rel)) result = !r.negate;
    }
    return result;
  }

  /** True if the path, or any of its parent directories, is matched. */
  matchesWithAncestors(rel) {
    const parts = rel.split('/');
    let acc = '';
    for (let i = 0; i < parts.length; i++) {
      acc = acc ? acc + '/' + parts[i] : parts[i];
      if (this.ignores(acc, i < parts.length - 1)) return true;
    }
    return false;
  }
}

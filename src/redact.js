// Secret redaction: prevents credentials from leaking into a prompt.
// Deliberately conservative patterns (high precision, low false positives).

const PATTERNS = [
  { type: 'private-key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { type: 'aws-access-key', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { type: 'github-token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { type: 'github-token', re: /\bgithub_pat_[A-Za-z0-9_]{50,}\b/g },
  { type: 'slack-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { type: 'google-api-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { type: 'anthropic-key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { type: 'openai-key', re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/g },
  { type: 'stripe-key', re: /\b[sr]k_(?:live|test)_[0-9A-Za-z]{20,}\b/g },
  { type: 'jwt', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  {
    // password = "...", api_key: '...', SECRET_TOKEN="..."
    type: 'credential',
    re: /((?:api[_-]?key|secret|token|passw(?:or)?d|private[_-]?key)["']?\s*[:=]\s*["'])([^"'\s]{8,})(["'])/gi,
    keep: 1,
  },
];

/**
 * @param {string} text
 * @returns {{ text: string, count: number, types: string[] }}
 */
export function redactSecrets(text) {
  let count = 0;
  const types = new Set();
  let out = text;
  for (const { type, re, keep } of PATTERNS) {
    out = out.replace(re, (...m) => {
      const value = keep ? m[2] : m[0];
      // leave obvious placeholders alone
      if (/^(?:x+|\*+|<.*>|your[_-].*|example.*|changeme|placeholder|\$\{.*\})$/i.test(value)) return m[0];
      count++;
      types.add(type);
      const tag = `[REDACTED:${type}]`;
      return keep ? m[1] + tag + m[3] : tag;
    });
  }
  return { text: out, count, types: [...types] };
}

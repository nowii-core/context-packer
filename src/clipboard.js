import { spawn } from 'node:child_process';

function tryCommand(cmd, args, input) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok) => {
      if (!settled) {
        settled = true;
        resolve(ok);
      }
    };
    try {
      const child = spawn(cmd, args, { stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true });
      child.on('error', () => done(false));
      child.on('close', (code) => done(code === 0));
      child.stdin.on('error', () => done(false));
      child.stdin.end(input);
    } catch {
      done(false);
    }
  });
}

/**
 * Copy text to the system clipboard using native tools (no dependencies).
 * macOS: pbcopy · Windows/WSL: clip.exe · Linux: wl-copy, xclip, xsel
 * @returns {Promise<boolean>} true if some backend succeeded
 */
export async function copyToClipboard(text) {
  const utf8 = Buffer.from(text, 'utf8');
  const candidates = [];

  if (process.platform === 'darwin') {
    candidates.push(['pbcopy', [], utf8]);
  } else if (process.platform === 'win32') {
    // clip.exe expects UTF-16LE with BOM to keep non-ASCII characters intact
    candidates.push(['clip', [], Buffer.from('﻿' + text, 'utf16le')]);
  } else {
    if (process.env.WAYLAND_DISPLAY) candidates.push(['wl-copy', [], utf8]);
    candidates.push(['xclip', ['-selection', 'clipboard'], utf8]);
    candidates.push(['xsel', ['--clipboard', '--input'], utf8]);
    candidates.push(['wl-copy', [], utf8]);
    candidates.push(['clip.exe', [], Buffer.from('﻿' + text, 'utf16le')]); // WSL
  }

  for (const [cmd, args, input] of candidates) {
    if (await tryCommand(cmd, args, input)) return true;
  }
  return false;
}

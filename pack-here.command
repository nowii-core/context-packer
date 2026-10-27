#!/bin/bash
# Double-click to pack the folder this file lives in. The result is copied to your clipboard.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required: https://nodejs.org"
  read -r -p "Press Enter to close..."
  exit 1
fi
node bin/ctx-pack.js . --copy
echo
echo "Done. Paste it into your AI chat with Cmd+V."
read -r -p "Press Enter to close..."

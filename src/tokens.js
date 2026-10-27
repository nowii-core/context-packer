// Fast, dependency-free token estimate.
// Real tokenizers differ per model; ~4 characters per token is a good
// rule of thumb for English text and source code (typically within ±15%).

export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function formatNumber(n) {
  return n.toLocaleString('en-US');
}

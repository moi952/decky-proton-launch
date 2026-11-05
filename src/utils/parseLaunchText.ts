export interface ParsedLaunchText {
  vars: Record<string, string>;
  // Tokens that aren't a plain VAR=value (a wrapper command, game
  // arguments after %command%...) — a group only carries env vars.
  unsupported: string[];
  unbalancedQuote: boolean;
}

// Shell-style split: whitespace separates tokens, '…' is literal, "…" honours
// \" and \\, and a bare backslash escapes the next character.
const tokenize = (text: string): { tokens: string[]; unbalanced: boolean } => {
  const tokens: string[] = [];
  let current = "";
  let inToken = false;
  let quote: "'" | '"' | null = null;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote === "'") {
      if (c === "'") quote = null;
      else current += c;
      continue;
    }
    if (quote === '"') {
      if (c === '"') quote = null;
      else if (
        c === "\\" &&
        i + 1 < text.length &&
        '"\\$`'.includes(text[i + 1])
      )
        current += text[++i];
      else current += c;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      inToken = true;
      continue;
    }
    if (c === "\\" && i + 1 < text.length) {
      current += text[++i];
      inToken = true;
      continue;
    }
    if (/\s/.test(c)) {
      if (inToken) {
        tokens.push(current);
        current = "";
        inToken = false;
      }
      continue;
    }
    current += c;
    inToken = true;
  }
  if (inToken) tokens.push(current);
  return { tokens, unbalanced: quote !== null };
};

const ASSIGNMENT_RE = /^([A-Za-z_][A-Za-z0-9_]*)=([\s\S]*)$/;

export const parseLaunchText = (text: string): ParsedLaunchText => {
  const { tokens, unbalanced } = tokenize(text);
  const vars: Record<string, string> = {};
  const unsupported: string[] = [];
  let afterCommand = false;

  for (const token of tokens) {
    if (token === "%command%") {
      afterCommand = true;
      continue;
    }
    const match = !afterCommand ? ASSIGNMENT_RE.exec(token) : null;
    if (match) vars[match[1]] = match[2];
    else unsupported.push(token);
  }

  return { vars, unsupported, unbalancedQuote: unbalanced };
};

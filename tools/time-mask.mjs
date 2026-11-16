// Per-pass timing of mask().
import { readFileSync } from 'node:fs';
import { Lexer } from '../src/lexer.js';
import { inline } from '../src/rules.js';
import { normalizeLabel } from '../src/util.js';

const K = '/home/ubuntu/.hermes/profiles/bot3/cache/scratch/makefun/md2/markdown-render-speed-02-kit';
const cases = JSON.parse(readFileSync(K + '/practice/input/cases.json', 'utf8')).slice(680);

const T = { p1: 0, p2: 0, p3: 0, n: 0, chars: 0, p1n: 0, p2n: 0, p3n: 0 };

Lexer.prototype.mask = function (src) {
  T.n++;
  T.chars += src.length;
  let masked = src;
  if (src.includes('[')) {
    T.p1n++;
    const a = performance.now();
    const links = this.tokens.links;
    const reflinkSearch = inline.reflinkSearch;
    const replace = (match) => {
      const at = match.lastIndexOf('[');
      if (!Object.hasOwn(links, normalizeLabel(match.slice(at + 1, -1)))) return match;
      if (at > 1 && match.charAt(0) !== '!') {
        const inner = match.slice(1, at - 1);
        if (this.linkInText(inner)) {
          return '[' + inner.replace(reflinkSearch, replace) + '][' + 'a'.repeat(match.length - at - 2) + ']';
        }
      }
      return '[' + 'a'.repeat(match.length - 2) + ']';
    };
    masked = masked.replace(reflinkSearch, replace);
    T.p1 += performance.now() - a;
  }
  if (masked.includes('`') || masked.includes('\\')) {
    T.p2n++;
    const a = performance.now();
    masked = masked.replace(inline.anyPunctuationOutsideCode, (m, s, r) =>
      r ? '+'.repeat(m.length) : s ? s + m.slice(s.length, -s.length).replace(/`/g, '+') + s : m,
    );
    T.p2 += performance.now() - a;
  }
  if (masked.includes('[') || masked.includes('`') || masked.includes('<')) {
    T.p3n++;
    const a = performance.now();
    masked = masked.replace(inline.blockSkip, (m, s, r) => {
      const len = r ? r.length : 0;
      return m.slice(0, len) + '[' + 'a'.repeat(m.length - len - 2) + ']';
    });
    T.p3 += performance.now() - a;
  }
  return masked;
};

const a = performance.now();
for (const c of cases) {
  const lx = new Lexer();
  lx.lex(c.markdown);
}
const total = performance.now() - a;
console.log({ totalMs: total.toFixed(1), ...Object.fromEntries(Object.entries(T).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(1) : v])) });

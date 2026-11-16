// blockTokens call stats: how many calls, how many chars, how much time, split by top-level vs nested.
import { readFileSync } from 'node:fs';
import { Lexer } from '../src/lexer.js';

const K = '/home/ubuntu/.hermes/profiles/bot3/cache/scratch/makefun/md2/markdown-render-speed-02-kit';
const cases = JSON.parse(readFileSync(K + '/practice/input/cases.json', 'utf8')).slice(680);

const orig = Lexer.prototype.blockTokens;
let calls = 0;
let chars = 0;
let ms = 0;
let depth = 0;
let nestedCalls = 0;
let nestedChars = 0;
let nestedMs = 0;
Lexer.prototype.blockTokens = function (src, tokens, inBq) {
  calls++;
  chars += src.length;
  const nested = depth > 0;
  if (nested) {
    nestedCalls++;
    nestedChars += src.length;
  }
  depth++;
  const a = performance.now();
  const r = orig.call(this, src, tokens, inBq);
  const d = performance.now() - a;
  depth--;
  ms += d;
  if (nested) nestedMs += d;
  return r;
};

const a = performance.now();
for (const c of cases) {
  const lx = new Lexer();
  lx.lex(c.markdown);
}
const total = performance.now() - a;
console.log({
  totalMs: total.toFixed(1),
  calls,
  chars,
  ms: ms.toFixed(1),
  nestedCalls,
  nestedChars,
  nestedMs: nestedMs.toFixed(1),
  avgNestedLen: Math.round(nestedChars / nestedCalls),
});

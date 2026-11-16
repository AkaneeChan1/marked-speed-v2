// How much does the inline pass repeat? Count inline block texts and distinct ones.
import { readFileSync } from 'node:fs';
import { Lexer } from '../src/lexer.js';

const K = '/home/ubuntu/.hermes/profiles/bot3/cache/scratch/makefun/md2/markdown-render-speed-02-kit';
const cases = JSON.parse(readFileSync(K + '/practice/input/cases.json', 'utf8'));

const orig = Lexer.prototype.inline;
let calls = 0;
let chars = 0;
const seen = new Map();
Lexer.prototype.inline = function (src, tokens = []) {
  calls++;
  chars += src.length;
  seen.set(src, (seen.get(src) || 0) + 1);
  return orig.call(this, src, tokens);
};

for (const c of cases) {
  const lx = new Lexer();
  lx.lex(c.markdown);
}
let dupChars = 0;
let dupCalls = 0;
for (const [s, n] of seen) {
  if (n > 1) {
    dupCalls += n - 1;
    dupChars += (n - 1) * s.length;
  }
}
console.log({
  calls,
  chars,
  distinct: seen.size,
  dupCalls,
  dupChars,
  pctCharsRepeated: ((100 * dupChars) / chars).toFixed(1) + '%',
});

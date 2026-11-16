// Count list() work: calls, successful tokens, items, inner-loop lines.
import { readFileSync } from 'node:fs';
import { BlockScanner } from '../src/block.js';
import { Lexer } from '../src/lexer.js';

const st = { calls: 0, ok: 0, items: 0, lines: 0, chars: 0 };
const orig = BlockScanner.prototype.list;
BlockScanner.prototype.list = function (src) {
  st.calls++;
  st.chars += src.length;
  const t = orig.call(this, src);
  if (t) {
    st.ok++;
    st.items += t.items.length;
  }
  return t;
};

const K = '/home/ubuntu/.hermes/profiles/bot3/cache/scratch/makefun/md2/markdown-render-speed-02-kit';
const cases = JSON.parse(readFileSync(K + '/practice/input/cases.json', 'utf8'));
let total = 0;
for (const c of cases.slice(680)) {
  total += c.markdown.length;
  const lx = new Lexer();
  lx.lex(c.markdown);
}
console.log(st);
console.log('avg src len per call', Math.round(st.chars / st.calls), 'doc chars', total);

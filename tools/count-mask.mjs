// How often does each mask pass run, and how often does it change the string?
import { readFileSync } from 'node:fs';
import { Lexer } from '../src/lexer.js';
import { inline } from '../src/rules.js';

const K = '/home/ubuntu/.hermes/profiles/bot3/cache/scratch/makefun/md2/markdown-render-speed-02-kit';
const cases = JSON.parse(readFileSync(K + '/practice/input/cases.json', 'utf8')).slice(680);

const st = { blocks: 0, masked: 0, p1: 0, p1changed: 0, p2: 0, p2changed: 0, p3: 0, p3changed: 0, chars: 0 };
const orig = Lexer.prototype.mask;
Lexer.prototype.mask = function (src) {
  st.blocks++;
  st.chars += src.length;
  const a = src.includes('[');
  const b = src.includes('`') || src.includes('\\');
  const c = src.includes('[') || src.includes('`') || src.includes('<');
  if (a) st.p1++;
  if (b) st.p2++;
  if (c) st.p3++;
  const out = orig.call(this, src);
  if (out !== src) st.masked++;
  return out;
};
for (const c of cases) {
  const lx = new Lexer();
  lx.lex(c.markdown);
}
console.log(st);

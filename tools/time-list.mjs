// Where does list() spend time? Wrap the internals with timers.
import { readFileSync } from 'node:fs';
import { BlockScanner } from '../src/block.js';
import { Lexer } from '../src/lexer.js';
import { block, other, listItemRegex, nextBulletRegex, hrRegex, fencesBeginRegex, headingBeginRegex, htmlBeginRegex, blockquoteBeginRegex } from '../src/rules.js';

const t = { exec: 0, hr: 0, itemLoop: 0, items: 0, blockTokens: 0, slice: 0, dbl: 0, task: 0 };
const now = () => performance.now();

const origBlockTokens = Lexer.prototype.blockTokens;

const K = '/home/ubuntu/.hermes/profiles/bot3/cache/scratch/makefun/md2/markdown-render-speed-02-kit';
const cases = JSON.parse(readFileSync(K + '/practice/input/cases.json', 'utf8'));
// Time the whole list stage by timing lex() with lists disabled vs enabled is awkward; instead time
// individual regexes on realistic inputs.
let s1, s2;
const origList = BlockScanner.prototype.list;
let totalList = 0;
BlockScanner.prototype.list = function (src) {
  const a = now();
  const r = origList.call(this, src);
  totalList += now() - a;
  return r;
};
const a = now();
for (const c of cases.slice(680)) {
  const lx = new Lexer();
  lx.lex(c.markdown);
}
const total = now() - a;
console.log({ totalMs: total.toFixed(1), listMs: totalList.toFixed(1) });

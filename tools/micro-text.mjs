// Micro-benchmark: scanText vs the inline.text regex on real block texts.
import { readFileSync } from 'node:fs';
import { Lexer } from '../src/lexer.js';
import { inline } from '../src/rules.js';
import { scanText } from '../src/textscan.js';

const K = '/home/ubuntu/.hermes/profiles/bot3/cache/scratch/makefun/md2/markdown-render-speed-02-kit';
const cases = JSON.parse(readFileSync(K + '/practice/input/cases.json', 'utf8')).slice(680);

// Collect the block texts that inlineTokens would see.
const texts = [];
const orig = Lexer.prototype.inline;
Lexer.prototype.inline = function (src, tokens) {
  texts.push(src);
  return orig.call(this, src, tokens);
};
for (const c of cases) new Lexer().lex(c.markdown);
console.log('blocks', texts.length, 'chars', texts.reduce((s, t) => s + t.length, 0));

function bench(fn, label) {
  let best = Infinity;
  for (let r = 0; r < 5; r++) {
    const t = process.hrtime.bigint();
    let acc = 0;
    for (const s of texts) acc += fn(s);
    const ms = Number(process.hrtime.bigint() - t) / 1e6;
    if (ms < best) best = ms;
    if (r === 0) console.log(label, 'acc', acc);
  }
  return best;
}

const a = bench((s) => {
  const m = inline.text.exec(s);
  return m ? m[0].length : 0;
}, 'regex');
const b = bench((s) => scanText(s), 'scan ');
console.log({ regexMs: a.toFixed(1), scanMs: b.toFixed(1), ratio: (b / a).toFixed(2) });

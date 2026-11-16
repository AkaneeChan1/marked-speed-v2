// Phase timing: block tokenisation (incl. recursion) vs the inline queue.
import { readFileSync } from 'node:fs';
import { Lexer } from '../src/lexer.js';

const K = '/home/ubuntu/.hermes/profiles/bot3/cache/scratch/makefun/md2/markdown-render-speed-02-kit';
const cases = JSON.parse(readFileSync(K + '/practice/input/cases.json', 'utf8'));

const origLex = Lexer.prototype.lex;
let blockMs = 0;
let inlineMs = 0;
const origBlockTokens = Lexer.prototype.blockTokens;
Lexer.prototype.blockTokens = function (...args) {
  const a = performance.now();
  const r = origBlockTokens.apply(this, args);
  blockMs += performance.now() - a;
  return r;
};
const origInlineTokens = Lexer.prototype.inlineTokens;
Lexer.prototype.inlineTokens = function (...args) {
  const a = performance.now();
  const r = origInlineTokens.apply(this, args);
  inlineMs += performance.now() - a;
  return r;
};

const a = performance.now();
for (const c of cases.slice(680)) {
  const lx = new Lexer();
  lx.lex(c.markdown);
}
const total = performance.now() - a;
console.log({ totalMs: total.toFixed(1), blockMs: blockMs.toFixed(1), inlineMs: inlineMs.toFixed(1) });

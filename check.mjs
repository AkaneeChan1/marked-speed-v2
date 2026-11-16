// Practice checker: renders every case with parse() and compares code unit for code unit with the
// kit's expected HTML. Prints passed/total and the first mismatch.
//
//   node check.mjs

import { readFileSync } from 'node:fs';
import { parse } from './parse.js';

const KIT = '/home/ubuntu/.hermes/profiles/bot3/cache/scratch/makefun/md2/markdown-render-speed-02-kit';
const cases = JSON.parse(readFileSync(`${KIT}/practice/input/cases.json`, 'utf8'));
const expected = JSON.parse(readFileSync(`${KIT}/practice/reference/expected.json`, 'utf8'));

const want = new Map(expected.cases.map((c) => [c.id, c.html]));

let passed = 0;
let firstBad = null;
for (const c of cases) {
  const got = parse(c.markdown);
  const exp = want.get(c.id);
  if (got === exp) passed++;
  else if (firstBad === null) {
    let at = 0;
    const n = Math.min(got.length, exp.length);
    while (at < n && got.charCodeAt(at) === exp.charCodeAt(at)) at++;
    const ctx = (s) => JSON.stringify(s.slice(Math.max(0, at - 40), at + 60));
    firstBad = { id: c.id, at, got: ctx(got), exp: ctx(exp), glen: got.length, elen: exp.length };
  }
}
console.log(`${passed}/${cases.length}`);
if (firstBad) {
  console.log(`first mismatch ${firstBad.id} at ${firstBad.at} (got ${firstBad.glen}, want ${firstBad.elen})`);
  console.log(`  got  ${firstBad.got}`);
  console.log(`  want ${firstBad.exp}`);
}

process.exitCode = passed === cases.length ? 0 : 1;

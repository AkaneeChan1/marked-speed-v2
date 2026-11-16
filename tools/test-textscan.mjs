// Differential test: hand-written text scanner vs marked's inline text rule, over every suffix of
// the practice corpus plus random strings.
import { readFileSync } from 'node:fs';
import { inline } from '../src/rules.js';
import { scanText } from '../src/textscan.js';

const K = '/home/ubuntu/.hermes/profiles/bot3/cache/scratch/makefun/md2/markdown-render-speed-02-kit';
const cases = JSON.parse(readFileSync(K + '/practice/input/cases.json', 'utf8'));

let checked = 0;
let bad = 0;
function check(s) {
  const m = inline.text.exec(s);
  const want = m ? m[0].length : -1;
  const got = scanText(s);
  checked++;
  if (got !== want) {
    bad++;
    if (bad <= 10) {
      console.log('MISMATCH', JSON.stringify(s.slice(0, 120)), 'want', want, 'got', got);
      console.log('  wantText', JSON.stringify(m ? m[0].slice(0, 120) : null));
      console.log('  gotText ', JSON.stringify(s.slice(0, got).slice(0, 120)));
    }
  }
}

// every suffix of a sample of the corpus (bounded work)
for (const c of cases) {
  const s = c.markdown;
  const step = Math.max(1, Math.floor(s.length / 400));
  for (let i = 0; i < s.length; i += step) check(s.slice(i, i + 400));
}

// random strings from a nasty alphabet
let seed = 12345;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const alphabet = [
  'a', 'Z', '0', ' ', '  ', '\n', '\t', '*', '_', '~', '`', '[', ']', '(', ')', '<', '>', '\\', '!', '&', '#',
  'h', 'H', 't', 'T', 'p', 'P', 's', 'S', 'f', 'F', 'w', 'W', 'm', 'M', 'x', 'X', ':', '/', '.', '@', '-', '+',
  'http', 'https', 'ftp://', 'www.', 'mailto:', 'xmpp:', 'a@b.co', 'é', '日', '|', '{', '}', '?', '=', "'", '"',
  '%', '$', '^', ';', ',', '  \n', '\\\n', '&amp;', '&#123;',
];
for (let i = 0; i < 300000; i++) {
  let s = '';
  const n = 1 + Math.floor(rnd() * 12);
  for (let j = 0; j < n; j++) s += alphabet[Math.floor(rnd() * alphabet.length)];
  check(s);
}

console.log(bad === 0 ? `text scanner OK (${checked} cases)` : `${bad} mismatches of ${checked}`);

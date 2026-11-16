// Does pass 3 ever change a block that has no '[' and no '<'? (Then pass 2's code-span pass
// has already masked everything pass 3 would.)
import { readFileSync } from 'node:fs';
import { Lexer } from '../src/lexer.js';
import { inline } from '../src/rules.js';

const K = '/home/ubuntu/.hermes/profiles/bot3/cache/scratch/makefun/md2/markdown-render-speed-02-kit';
const cases = JSON.parse(readFileSync(K + '/practice/input/cases.json', 'utf8'));

const st = { checked: 0, changed: 0, examples: [] };
const orig = Lexer.prototype.mask;
Lexer.prototype.mask = function (src) {
  const out = orig.call(this, src);
  if (!src.includes('[') && !src.includes('<')) {
    st.checked++;
    const afterP2 = src.includes('`') || src.includes('\\')
      ? src.replace(inline.anyPunctuationOutsideCode, (m, s, r) =>
          r ? '+'.repeat(m.length) : s ? s + m.slice(s.length, -s.length).replace(/`/g, '+') + s : m,
        )
      : src;
    const afterP3 = afterP2.replace(inline.blockSkip, (m, s, r) => {
      const len = r ? r.length : 0;
      return m.slice(0, len) + '[' + 'a'.repeat(m.length - len - 2) + ']';
    });
    if (afterP3 !== afterP2) {
      st.changed++;
      if (st.examples.length < 3) st.examples.push({ src: src.slice(0, 120), afterP2: afterP2.slice(0, 120), afterP3: afterP3.slice(0, 120) });
    }
  }
  return out;
};
for (const c of cases) new Lexer().lex(c.markdown);
console.log(st);

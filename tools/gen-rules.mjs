// One-off generator: emits src/rules.js from the vendored marked's rule tables, so the regex
// sources are exact. The output is committed source; this script is not part of the entry.
import { writeFileSync } from 'node:fs';
import { Lexer } from '../vendor/marked/marked.esm.js';

const lx = new Lexer();
const T = lx.tokenizer.rules.other;
const B = Lexer.rules.block.gfm;
const I = Lexer.rules.inline.gfm;

const lit = (v) => {
  if (v instanceof RegExp) return `/${v.source}/${v.flags}`;
  return null;
};

const emit = (name, obj, skip = []) => {
  const out = [`export const ${name} = {`];
  for (const [k, v] of Object.entries(obj)) {
    if (skip.includes(k)) continue;
    const s = lit(v);
    if (s === null) continue;
    out.push(`  ${k}: ${s},`);
  }
  out.push('};');
  return out.join('\n');
};

const header = `// Rule tables for marked 18.1.3's default configuration (gfm: true, breaks: false,
// pedantic: false). The regex sources are marked's, verbatim: they are the specification of what
// the scanner must accept, and every one of them is exercised by the practice set.
//
// Copyright (c) 2018-2026, MarkedJS. (MIT License)
// Copyright (c) 2011-2018, Christopher Jeffrey. (MIT License)
// See vendor/marked/LICENSE and vendor/marked/NOTICE.
`;

const body = [
  header,
  `export const HTML_TAGS = 'address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul';`,
  emit('other', T, [
    'listItemRegex', 'nextBulletRegex', 'hrRegex', 'fencesBeginRegex',
    'headingBeginRegex', 'pedanticHeadingBeginRegex', 'htmlBeginRegex', 'blockquoteBeginRegex',
  ]),
  '',
  emit('block', B),
  '',
  emit('inline', I),
  '',
  `// The per-indent rule factories. marked memoises these by indent (0..3); so do we.
const memo = (make) => {
  const cache = [];
  return (n) => {
    const i = n < 1 ? 0 : n > 3 ? 3 : n - 1;
    return cache[i] || (cache[i] = make(i));
  };
};

export const listItemRegex = (n) => new RegExp(\`^( {0,3}\${n})((?:[\\t ][^\\\\n]*)?(?:\\\\n|$))\`));
export const nextBulletRegex = memo((n) => new RegExp(\`^ {0,\${n}}(?:[*+-]|\\\\d{1,9}[.)])((?:[ \\t][^\\\\n]*)?(?:\\\\n|$))\`));
export const hrRegex = memo((n) => new RegExp(\`^ {0,\${n}}((?:-[ \\t]*){3,}|(?:_[ \\t]*){3,}|(?:\\\\*[ \\t]*){3,})(?:\\\\n+|$)\`));
export const fencesBeginRegex = memo((n) => new RegExp(\`^ {0,\${n}}(?:\\\`\\\`\\\`|~~~)\`));
export const headingBeginRegex = memo((n) => new RegExp(\`^ {0,\${n}}#{1,6}(?:\\\\s|$)\`));
export const pedanticHeadingBeginRegex = memo((n) => new RegExp(\`^ {0,\${n}}#\`));
export const blockquoteBeginRegex = memo((n) => new RegExp(\`^ {0,\${n}}>\`));
export const htmlBeginRegex = memo((n) => new RegExp(\`^ {0,\${n}}(?:</?(?:\${HTML_TAGS})(?: +|$|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\\\s>]|$)|!--)|<\\\\?|<![A-Za-z]|<!\\\\[CDATA\\\\[)\`, 'i'));
`,
];

writeFileSync(new URL('../src/rules.js', import.meta.url), body.join('\n'));
console.log('wrote src/rules.js');

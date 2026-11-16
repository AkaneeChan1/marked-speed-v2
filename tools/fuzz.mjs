// Differential fuzzer: random markdown-ish documents, our parse() vs the vendored marked.
// Any difference is printed with the input so it can be turned into a regression case.
import { marked } from '../vendor/marked/marked.esm.js';
import { parse } from '../parse.js';

let seed = Number(process.argv[2] || 1);
const N = Number(process.argv[3] || 2000);
function rnd() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (n) => Math.floor(rnd() * n);

const words = ['foo', 'bar', 'baz', 'a', 'x1', 'hello', 'world', 'HTTP', 'www', 'test', 'é', '日本', 'a_b', 'snake_case'];
const punct = ['.', ',', '!', '?', ':', ';', '-', '(', ')', '"', "'", '/', '\\', '&', '&amp;', '&lt;', '#', '@', '%', '+', '=', '|', '{', '}', '$', '^', '~'];
const inlineBits = [
  () => pick(words),
  () => pick(punct),
  () => ' ',
  () => '  ',
  () => '\n',
  () => '*' + pick(words) + '*',
  () => '**' + pick(words) + '**',
  () => '***' + pick(words) + '***',
  () => '_' + pick(words) + '_',
  () => '__' + pick(words) + '__',
  () => '~~' + pick(words) + '~~',
  () => '`' + pick(words) + '`',
  () => '``' + pick(words) + '`' + pick(words) + '``',
  () => '[' + pick(words) + '](http://x.y/' + pick(words) + ')',
  () => '[' + pick(words) + '](<http://x.y/a b>)',
  () => '[' + pick(words) + '][ref]',
  () => '[ref]',
  () => '[ref][]',
  () => '![' + pick(words) + '](img.png "t")',
  () => '![ref]',
  () => '<http://a.b/c>',
  () => '<a@b.co>',
  () => '<span class="x">' + pick(words) + '</span>',
  () => '<!-- c -->',
  () => 'http://a.b/c?d=e&f=g',
  () => 'www.a.b/c',
  () => 'a@b.co',
  () => 'mailto:a@b.co',
  () => '\\' + pick(['*', '_', '`', '[', ']', '\\', '#', '!', '<', '>', '&']),
  () => '&#' + int(300) + ';',
  () => '&nbsp;',
  () => '  \n',
  () => '\\\n',
  () => '|',
  () => '||',
  () => '[]',
  () => '()',
  () => '!',
  () => '[' + pick(words) + '](' + pick(words) + ')',
  () => '**' + pick(words) + '*' + pick(words) + '**',
  () => '*' + pick(words) + '**' + pick(words) + '*',
  () => '_' + pick(words) + '__' + pick(words) + '_',
  () => 'a_b_c',
  () => '**a*b**',
  () => '~~a~b~~',
  () => '`a``b`',
  () => '`` ` ``',
];

function inline(n) {
  let s = '';
  for (let i = 0; i < n; i++) s += pick(inlineBits)();
  return s;
}

const blockBits = [
  () => inline(1 + int(6)) + '\n',
  () => inline(1 + int(4)) + '\n\n',
  () => '#'.repeat(1 + int(6)) + ' ' + inline(2) + '\n',
  () => inline(2) + '\n' + pick(['===', '---', '= =', '- -']) + '\n',
  () => '> ' + inline(3) + '\n',
  () => '> ' + inline(2) + '\n>\n> ' + inline(2) + '\n',
  () => '> > ' + inline(2) + '\n',
  () => '- ' + inline(2) + '\n- ' + inline(2) + '\n',
  () => '* ' + inline(2) + '\n\n* ' + inline(2) + '\n',
  () => '1. ' + inline(2) + '\n2. ' + inline(2) + '\n',
  () => '1) ' + inline(2) + '\n',
  () => '- [ ] ' + inline(2) + '\n- [x] ' + inline(2) + '\n',
  () => '- ' + inline(2) + '\n\n  ' + inline(2) + '\n',
  () => '- ' + inline(2) + '\n  - ' + inline(2) + '\n    - ' + inline(2) + '\n',
  () => '    code ' + inline(2) + '\n',
  () => '\tcode ' + inline(2) + '\n',
  () => '```js\n' + inline(2) + '\n```\n',
  () => '~~~\n' + inline(2) + '\n~~~\n',
  () => '```\n' + inline(2) + '\n',
  () => '| a | b |\n| - | - |\n| ' + pick(words) + ' | ' + pick(words) + ' |\n',
  () => '| a | b |\n|:-:|--:|\n| 1 | 2 |\n| 3 | 4 |\n',
  () => 'a | b\n--- | ---\n1 | 2\n',
  () => '<div>\n' + inline(2) + '\n</div>\n',
  () => '<pre>\n' + inline(2) + '\n</pre>\n',
  () => '<!-- ' + inline(2) + ' -->\n',
  () => '[ref]: http://x.y/z "title"\n',
  () => '[ref]: <http://x.y/z>\n',
  () => '***\n',
  () => '---\n',
  () => '___\n',
  () => '\n',
  () => '   \n',
  () => '  ' + inline(2) + '\n',
  () => '   ' + inline(2) + '\n',
  () => '    ' + inline(2) + '\n',
  () => '\t' + inline(2) + '\n',
  () => inline(2) + '\n' + '  ' + inline(2) + '\n',
  () => '> - ' + inline(2) + '\n>   ' + inline(2) + '\n',
  () => '- > ' + inline(2) + '\n',
  () => '1. > ' + inline(2) + '\n',
  () => '- ```\n  ' + inline(2) + '\n  ```\n',
  () => '- # ' + inline(2) + '\n',
  () => '- ' + inline(2) + '\n\n' + inline(2) + '\n',
  () => '> ' + inline(2) + '\n\n' + inline(2) + '\n',
  () => '> ' + inline(2) + '\n> ' + inline(2) + '\n\n' + inline(2) + '\n',
  () => '- ' + inline(2) + '\n- ' + inline(2) + '\n\n- ' + inline(2) + '\n',
  () => '1. a\n\n   b\n\n2. c\n',
  () => '- a\n\n      code\n',
  () => '*a **b** c*\n',
  () => '**a *b* c**\n',
  () => 'a***b***c\n',
  () => '**foo*\n',
  () => '*foo**\n',
  () => 'foo*bar*baz\n',
  () => 'foo_bar_baz\n',
  () => '__foo__bar\n',
  () => 'a ** b ** c\n',
  () => '~~a~~b~~c~~\n',
  () => '`a` `b`\n',
  () => '``a`b``\n',
  () => '` a `\n',
  () => '`  `\n',
  () => '[a](b) [c](d)\n',
  () => '[a [b] c](d)\n',
  () => '[a](b(c))\n',
  () => '[a](b "t" )\n',
  () => '[a](<b c>)\n',
  () => '![a](b)\n',
  () => '[![a](b)](c)\n',
  () => '<a href="x">y</a>\n',
  () => 'text <b>bold</b> text\n',
  () => 'a<br>b\n',
  () => 'a  \nb\n',
  () => 'a\\\nb\n',
  () => '&copy; &#169; &#xA9; &bogus;\n',
  () => 'AT&T & &amp;\n',
  () => 'http://a.b/c_d_e\n',
  () => 'see www.a.b/c.\n',
  () => 'mail a@b.co now\n',
  () => 'x < y > z\n',
  () => 'a < b\n',
  () => '1. a\n1. b\n1. c\n',
  () => '10. a\n11. b\n',
  () => '- a\n+ b\n* c\n',
  () => '- a\n\n\n- b\n',
  () => '> a\n> b\n\n> c\n',
  () => '# h1\n## h2\n###### h6\n####### h7\n',
  () => '# h1 #\n## h2 ##\n# h # x\n',
  () => 'Setext\n===\n\nSetext2\n---\n',
  () => 'a\nb\n===\n',
  () => '|a|\n|-|\n|b|\n',
  () => '|a|b|\n|-|-|\n|c|\n',
  () => '| a |\n| --- |\n| `x|y` |\n',
  () => '| a |\n| --- |\n| a\\|b |\n',
  () => 'term\n: def\n',
  () => '- [ ]\n',
  () => '- [x] a\n  - [ ] b\n',
  () => '> - [ ] a\n',
  () => '1. [ ] a\n',
  () => '- a\n  > b\n',
  () => '- a\n\n  > b\n',
  () => '> ```\n> a\n> ```\n',
  () => '>     code\n',
  () => '> # h\n',
  () => '> | a |\n> | - |\n> | b |\n',
  () => '> a\n> ===\n',
  () => '- a\n  ===\n',
  () => '- a\n  ---\n',
  () => 'a\n\n\n\nb\n',
  () => '  \n\n  \n',
  () => '\n\n\n',
  () => 'a\n \n b\n',
  () => 'a\n\tb\n',
  () => 'a\n    b\n',
  () => 'a\n   b\n',
  () => 'a\n  b\n',
  () => 'a\n b\n',
  () => 'a\nb\n',
  () => 'a\n\nb\n',
  () => 'a\n\n b\n',
  () => 'a\n\n  b\n',
  () => 'a\n\n   b\n',
  () => 'a\n\n    b\n',
  () => 'a\n\n\tb\n',
];

function doc() {
  let s = '';
  const n = 1 + int(8);
  for (let i = 0; i < n; i++) s += pick(blockBits)();
  return s;
}

let fails = 0;
for (let i = 0; i < N; i++) {
  const md = doc();
  let a;
  let b;
  let ea = null;
  let eb = null;
  try {
    a = parse(md);
  } catch (e) {
    ea = e;
  }
  try {
    b = marked.parse(md);
  } catch (e) {
    eb = e;
  }
  if (ea || eb) {
    if (!!ea !== !!eb) {
      fails++;
      console.log('--- THROW MISMATCH', JSON.stringify(md), 'ours:', ea && ea.message, 'marked:', eb && eb.message);
      if (fails > 5) break;
    }
    continue;
  }
  if (a !== b) {
    fails++;
    console.log('--- MISMATCH', JSON.stringify(md));
    console.log('  ours  ', JSON.stringify(a));
    console.log('  marked', JSON.stringify(b));
    if (fails > 5) break;
  }
}
console.log(fails === 0 ? 'fuzz OK (' + N + ' docs)' : fails + ' mismatches');

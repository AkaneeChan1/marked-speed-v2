// Manual section timing for BlockScanner.list on the document set.
import { readFileSync } from 'node:fs';
import { block, other, listItemRegex } from '../src/rules.js';
import { blockquoteBeginRegex, fencesBeginRegex, headingBeginRegex, hrRegex, htmlBeginRegex, nextBulletRegex } from '../src/rules.js';
import { expandTabs } from '../src/util.js';
import { Lexer } from '../src/lexer.js';

const K = '/home/ubuntu/.hermes/profiles/bot3/cache/scratch/makefun/md2/markdown-render-speed-02-kit';
const cases = JSON.parse(readFileSync(K + '/practice/input/cases.json', 'utf8')).slice(680);

// A copy of list() with the sections timed, operating on a Lexer's block scanner.
const T = { head: 0, items: 0, lineLoop: 0, tail: 0, blockTokens: 0, n: 0, lines: 0, itemsN: 0 };

function timedList(self, src) {
  const t0 = performance.now();
  const cap = block.list.exec(src);
  if (!cap) return;
  const original = src;
  const consumed = () => original.length - src.length;
  let bullet = cap[1].trim();
  const ordered = bullet.length > 1;
  const token = { type: 'list', raw: '', ordered, start: ordered ? +bullet.slice(0, -1) : '', loose: false, items: [] };
  bullet = ordered ? '\\d{1,9}\\' + bullet.slice(-1) : '\\' + bullet;
  const itemRe = listItemRegex(bullet);
  let looseSeen = false;
  T.head += performance.now() - t0;

  while (src) {
    const ti = performance.now();
    let blankItem = false;
    let itemText = '';
    const item = itemRe.exec(src);
    if (!item || block.hr.test(src)) break;
    const itemStart = consumed();
    src = src.substring(item[0].length);
    const firstRaw = item[2] || '';
    const firstNl = firstRaw.indexOf('\n');
    const firstLine = firstNl === -1 ? firstRaw : firstRaw.slice(0, firstNl);
    const bulletWidth = item[1].length;
    let line = firstLine;
    const firstC = firstLine.charCodeAt(0);
    if (firstC === 32 || firstC === 9) line = firstLine.replace(other.leadingSpaceTab, (ws) => expandTabs(ws, bulletWidth));
    let blank = !line.trim();
    let indent = 0;
    if (blank) indent = bulletWidth + 1;
    else {
      indent = line.search(other.nonSpaceChar);
      indent = indent > 4 ? 1 : indent;
      itemText = line.slice(indent);
      indent += bulletWidth;
    }
    if (blank) {
      const nl = src.indexOf('\n');
      const nextLine = nl === -1 ? src : src.slice(0, nl);
      if (other.blankLine.test(nextLine)) {
        src = src.substring(nextLine.length + 1);
        blankItem = true;
      }
    }
    T.items += performance.now() - ti;

    if (!blankItem) {
      const tl = performance.now();
      while (src) {
        T.lines++;
        const nl = src.indexOf('\n');
        const rawLine = nl === -1 ? src : src.slice(0, nl);
        let expanded = rawLine;
        const c0 = rawLine.charCodeAt(0);
        if (c0 === 32 || c0 === 9) expanded = rawLine.replace(other.leadingSpaceTab, (ws) => expandTabs(ws));
        let brk = false;
        {
          const n = rawLine.length;
          let i = 0;
          while (i < indent && i < n && rawLine.charCodeAt(i) === 32) i++;
          if (i < n) {
            const c = rawLine.charCodeAt(i);
            switch (c) {
              case 96:
              case 126:
                brk = fencesBeginRegex(indent).test(rawLine);
                break;
              case 35:
                brk = headingBeginRegex(indent).test(rawLine);
                break;
              case 60:
                brk = htmlBeginRegex(indent).test(rawLine);
                break;
              case 62:
                brk = blockquoteBeginRegex(indent).test(rawLine);
                break;
              case 42:
              case 43:
              case 45:
                brk = nextBulletRegex(indent).test(rawLine) || hrRegex(indent).test(rawLine);
                break;
              case 95:
                brk = hrRegex(indent).test(rawLine);
                break;
              default:
                if (c >= 48 && c <= 57) brk = nextBulletRegex(indent).test(rawLine);
            }
          }
        }
        if (brk) break;
        if (expanded.search(other.nonSpaceChar) >= indent || !rawLine.trim()) {
          itemText += '\n' + expanded.slice(indent);
        } else {
          if (
            blank ||
            line.replace(other.tabCharGlobal, '    ').search(other.nonSpaceChar) >= 4 ||
            false
          ) {
            break;
          }
          const setext = false && /^ {0,3}(?:=+|-+) *$/.test(rawLine) && block.lheading.test(line + '\n' + rawLine)
            ? '    ' + expanded.replace(/^ {0,3}/, '')
            : rawLine;
          itemText += '\n' + setext;
        }
        blank = !rawLine.trim();
        src = src.substring(rawLine.length + 1);
        line = expanded.slice(indent);
      }
      T.lineLoop += performance.now() - tl;
    }

    T.itemsN++;
    const itemRaw = original.slice(itemStart, consumed());
    if (!token.loose) {
      if (looseSeen) token.loose = true;
      else if (other.doubleBlankLine.test(itemRaw)) looseSeen = true;
    }
    token.items.push({ type: 'list_item', raw: itemRaw, task: other.listIsTask.test(itemText), loose: false, text: itemText, tokens: [] });
  }
  const lastItem = token.items[token.items.length - 1];
  if (!lastItem) return;
  lastItem.raw = lastItem.raw.trimEnd();
  lastItem.text = lastItem.text.trimEnd();
  token.raw = original.slice(0, consumed()).trimEnd();

  const tb = performance.now();
  for (const item of token.items) {
    self.lexer.state.top = false;
    item.tokens = self.lexer.blockTokens(item.text, []);
  }
  T.blockTokens += performance.now() - tb;
  T.n++;
  return token;
}

const a = performance.now();
for (const c of cases) {
  const lx = new Lexer();
  lx.block.list = (src) => timedList(lx.block, src);
  lx.lex(c.markdown);
}
const total = performance.now() - a;
console.log({ totalMs: total.toFixed(1), ...Object.fromEntries(Object.entries(T).map(([k, v]) => [k, v.toFixed ? v.toFixed(1) : v])) });

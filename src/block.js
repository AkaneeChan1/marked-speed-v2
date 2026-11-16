// The block scanner: a port of marked 18.1.3's block Tokenizer (MIT; see vendor/marked/LICENSE),
// specialised to the default configuration (gfm on, pedantic off, breaks off).

import {
  block,
  inline,
  blockquoteBeginRegex,
  fencesBeginRegex,
  headingBeginRegex,
  hrRegex,
  htmlBeginRegex,
  listItemRegex,
  nextBulletRegex,
  other,
} from './rules.js';
import {
  compensateIndent,
  expandTabs,
  findClosingBracket,
  normalizeLabel,
  splitRow,
  stripTrailing,
  trimTrailingBlankLines,
} from './util.js';

const SETEXT_LINE = /^ {0,3}(?:=+|-+) *$/;

/**
 * Does `line` start a block that ends the current list item? Equivalent to running
 * fencesBeginRegex || headingBeginRegex || htmlBeginRegex || blockquoteBeginRegex ||
 * nextBulletRegex || hrRegex with this indent; the caller passes in the six memoised rules.
 */
function breaksListItem(line, indent, reFences, reHeading, reHtml, reBq, reBullet, reHr) {
  const n = line.length;
  let i = 0;
  while (i < indent && i < n && line.charCodeAt(i) === 32) i++;
  if (i >= n) return false;
  switch (line.charCodeAt(i)) {
    case 96: // `
    case 126: // ~
      return reFences.test(line);
    case 35: // #
      return reHeading.test(line);
    case 60: // <
      return reHtml.test(line);
    case 62: // >
      return reBq.test(line);
    case 42: // *
    case 43: // +
    case 45: // -
      return reBullet.test(line) || reHr.test(line);
    case 95: // _
      return reHr.test(line);
    default: {
      const c = line.charCodeAt(i);
      return c >= 48 && c <= 57 ? reBullet.test(line) : false;
    }
  }
}

/** First index that is neither a space nor a tab (-1 if none). Equivalent to /[^ \t]/.search. */
function firstNonSpace(s) {
  const n = s.length;
  for (let i = 0; i < n; i++) {
    const c = s.charCodeAt(i);
    if (c !== 32 && c !== 9) return i;
  }
  return -1;
}

/** `s.trim().length === 0` without allocating the trimmed string. */
function isBlank(s) {
  const n = s.length;
  for (let i = 0; i < n; i++) {
    const c = s.charCodeAt(i);
    if (c !== 32 && c !== 9) {
      if (c === 11 || c === 12 || c === 13 || c > 127) return s.trim().length === 0;
      return false;
    }
  }
  return true;
}

/** `/\n[ \t]*\n[ \t]*$/` without scanning the whole string. */
function hasDoubleBlankLine(s) {
  let i = s.length - 1;
  while (i >= 0 && (s.charCodeAt(i) === 32 || s.charCodeAt(i) === 9)) i--;
  if (i < 0 || s.charCodeAt(i) !== 10) return false;
  i--;
  while (i >= 0 && (s.charCodeAt(i) === 32 || s.charCodeAt(i) === 9)) i--;
  return i >= 0 && s.charCodeAt(i) === 10;
}

/** The subset used when deciding whether a paragraph line continues the list item. */
function breaksItemContinuation(line, indent) {
  const n = line.length;
  let i = 0;
  while (i < indent && i < n && line.charCodeAt(i) === 32) i++;
  if (i >= n) return false;
  const c = line.charCodeAt(i);
  switch (c) {
    case 96:
    case 126:
      return fencesBeginRegex(indent).test(line);
    case 35:
      return headingBeginRegex(indent).test(line);
    case 60:
      return htmlBeginRegex(indent).test(line);
    case 45:
    case 42:
    case 95:
      return hrRegex(indent).test(line);
    default:
      return false;
  }
}

export class BlockScanner {
  constructor(lexer) {
    this.lexer = lexer;
  }

  space(src) {
    const cap = block.newline.exec(src);
    if (cap && cap[0].length > 0) return { type: 'space', raw: cap[0] };
  }

  code(src) {
    const cap = block.code.exec(src);
    if (cap) {
      const raw = trimTrailingBlankLines(cap[0]);
      return { type: 'code', raw, codeBlockStyle: 'indented', text: raw.replace(other.codeRemoveIndent, '') };
    }
  }

  fences(src) {
    const cap = block.fences.exec(src);
    if (cap) {
      const raw = cap[0];
      return {
        type: 'code',
        raw,
        lang: cap[2] ? cap[2].trim().replace(inline.anyPunctuation, '$1') : cap[2],
        text: compensateIndent(raw, cap[3] || '', { other }),
      };
    }
  }

  heading(src) {
    const cap = block.heading.exec(src);
    if (cap) {
      let text = cap[2].trim();
      if (other.endingHash.test(text)) {
        const trimmed = stripTrailing(text, '#');
        if (!trimmed || other.endingSpaceTabChar.test(trimmed)) text = trimmed.trim();
      }
      return { type: 'heading', raw: stripTrailing(cap[0], '\n'), depth: cap[1].length, text, tokens: this.lexer.inline(text) };
    }
  }

  hr(src) {
    const cap = block.hr.exec(src);
    if (cap) return { type: 'hr', raw: stripTrailing(cap[0], '\n') };
  }

  blockquote(src) {
    const cap = block.blockquote.exec(src);
    if (!cap) return;
    let lines = stripTrailing(cap[0], '\n').split('\n');
    let raw = '';
    let text = '';
    const tokens = [];
    while (lines.length > 0) {
      let inBlock = false;
      const blockLines = [];
      let i;
      for (i = 0; i < lines.length; i++) {
        if (other.blockquoteStart.test(lines[i])) {
          blockLines.push(lines[i]);
          inBlock = true;
        } else if (!inBlock) blockLines.push(lines[i]);
        else break;
      }
      lines = lines.slice(i);
      const blockRaw = blockLines.join('\n');
      const blockText = blockRaw
        .replace(other.blockquoteMarkerWhitespace, (m, marker, ws) => marker + expandTabs(ws, marker.length))
        .replace(other.blockquoteSetextReplace, '\n    $1')
        .replace(other.blockquoteSetextReplace2, '');
      raw = raw ? raw + '\n' + blockRaw : blockRaw;
      text = text ? text + '\n' + blockText : blockText;
      const oldTop = this.lexer.state.top;
      this.lexer.state.top = true;
      this.lexer.blockTokens(blockText, tokens, true);
      this.lexer.state.top = oldTop;
      if (lines.length === 0) break;
      const last = tokens[tokens.length - 1];
      if (last === undefined) break;
      const type = last.type;
      if (type === 'code' || type === 'heading' || type === 'hr' || type === 'html' || type === 'table') break;
      if (type === 'blockquote') {
        const newRaw = last.raw + '\n' + lines.join('\n').replace(other.blockquoteSetextReplace2, '');
        const newToken = this.blockquote(newRaw);
        tokens[tokens.length - 1] = newToken;
        const remaining = newRaw.substring(newToken.raw.length).replace(/^\n/, '');
        const remainingLines = remaining ? remaining.split('\n').length : 0;
        const consumed = remainingLines ? lines.slice(0, -remainingLines) : lines;
        if (consumed.length > 0) raw = raw + '\n' + consumed.join('\n');
        text = text.substring(0, text.length - last.text.length) + newToken.text;
        lines = lines.slice(consumed.length);
        if (lines.length > 0 && other.blockquoteStart.test(lines[0])) continue;
        break;
      } else if (type === 'list') {
        const newRaw = last.raw + '\n' + lines.join('\n');
        const newToken = this.list(newRaw);
        tokens[tokens.length - 1] = newToken;
        const consumed =
          newToken.raw.length > last.raw.length ? newRaw.slice(last.raw.length + 1, newToken.raw.length).split('\n').length : 0;
        if (consumed > 0) {
          const consumedLines = lines.slice(0, consumed).join('\n');
          raw = raw + '\n' + consumedLines;
          text = text + '\n' + consumedLines;
        }
        lines = lines.slice(consumed);
        continue;
      }
    }
    return { type: 'blockquote', raw, tokens, text };
  }

  list(src) {
    const cap = block.list.exec(src);
    if (!cap) return;
    const original = src;
    const consumed = () => original.length - src.length;
    let bullet = cap[1].trim();
    const ordered = bullet.length > 1;
    const token = {
      type: 'list',
      raw: '',
      ordered,
      start: ordered ? +bullet.slice(0, -1) : '',
      loose: false,
      items: [],
    };
    bullet = ordered ? '\\d{1,9}\\' + bullet.slice(-1) : '\\' + bullet;
    const itemRe = listItemRegex(bullet);
    let looseSeen = false;
    while (src) {
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
      let blank = isBlank(line);
      let indent = 0;
      if (blank) {
        indent = bulletWidth + 1;
      } else {
        indent = firstNonSpace(line);
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
      if (!blankItem) {
        const reFences = fencesBeginRegex(indent);
        const reHeading = headingBeginRegex(indent);
        const reHtml = htmlBeginRegex(indent);
        const reBq = blockquoteBeginRegex(indent);
        const reBullet = nextBulletRegex(indent);
        const reHr = hrRegex(indent);
        const total = src.length;
        let pos = 0;
        while (pos < total) {
          const nl = src.indexOf('\n', pos);
          const end = nl === -1 ? total : nl;
          const rawLine = src.slice(pos, end);
          let expanded = rawLine;
          const c0 = rawLine.charCodeAt(0);
          if (c0 === 32 || c0 === 9) expanded = rawLine.replace(other.leadingSpaceTab, (ws) => expandTabs(ws));
          if (breaksListItem(rawLine, indent, reFences, reHeading, reHtml, reBq, reBullet, reHr)) break;
          const blankLine = isBlank(rawLine);
          if (firstNonSpace(expanded) >= indent || blankLine) {
            itemText += '\n' + expanded.slice(indent);
          } else {
            if (
              blank ||
              line.replace(other.tabCharGlobal, '    ').search(other.nonSpaceChar) >= 4 ||
              breaksItemContinuation(line, indent)
            ) {
              break;
            }
            const setext =
              SETEXT_LINE.test(rawLine) && block.lheading.test(line + '\n' + rawLine)
                ? '    ' + expanded.replace(/^ {0,3}/, '')
                : rawLine;
            itemText += '\n' + setext;
          }
          blank = blankLine;
          pos = end + 1;
          line = expanded.slice(indent);
        }
        src = src.substring(pos);
      }
      const itemRaw = original.slice(itemStart, consumed());
      if (!token.loose) {
        if (looseSeen) token.loose = true;
        else if (hasDoubleBlankLine(itemRaw)) looseSeen = true;
      }
      token.items.push({
        type: 'list_item',
        raw: itemRaw,
        task: other.listIsTask.test(itemText),
        loose: false,
        text: itemText,
        tokens: [],
      });
    }
    const lastItem = token.items[token.items.length - 1];
    if (!lastItem) return;
    lastItem.raw = lastItem.raw.trimEnd();
    lastItem.text = lastItem.text.trimEnd();
    token.raw = original.slice(0, consumed()).trimEnd();
    for (const item of token.items) {
      this.lexer.state.top = false;
      item.tokens = this.lexer.blockTokens(item.text, []);
      if (!token.loose) {
        let loose = false;
        for (const t of item.tokens) {
          if (t.type === 'space' && other.anyLine.test(t.raw)) {
            loose = true;
            break;
          }
        }
        token.loose = loose;
      }
    }
    for (const item of token.items) {
      const first = item.tokens[0];
      if (item.task && first !== undefined && (first.type === 'text' || first.type === 'paragraph')) {
        item.text = item.text.replace(other.listReplaceTask, '');
        first.raw = first.raw.replace(other.listReplaceTask, '');
        first.text = first.text.replace(other.listReplaceTask, '');
        const queue = this.lexer.inlineQueue;
        for (let i = queue.length - 1; i >= 0; i--) {
          if (other.listIsTask.test(queue[i].src)) {
            queue[i].src = queue[i].src.replace(other.listReplaceTask, '');
            break;
          }
        }
        const box = other.listTaskCheckbox.exec(item.raw);
        if (box) {
          const checkbox = { type: 'checkbox', raw: box[0] + ' ', checked: box[0] !== '[ ]' };
          item.checked = checkbox.checked;
          if (token.loose) {
            const head = item.tokens[0];
            if (head && (head.type === 'paragraph' || head.type === 'text') && head.tokens) {
              head.raw = checkbox.raw + head.raw;
              head.text = checkbox.raw + head.text;
              head.tokens.unshift(checkbox);
            } else {
              item.tokens.unshift({ type: 'paragraph', raw: checkbox.raw, text: checkbox.raw, tokens: [checkbox] });
            }
          } else {
            item.tokens.unshift(checkbox);
          }
        }
      } else if (item.task) {
        item.task = false;
      }
    }
    if (token.loose) {
      for (const item of token.items) {
        item.loose = true;
        for (const t of item.tokens) if (t.type === 'text') t.type = 'paragraph';
      }
    }
    return token;
  }

  html(src) {
    const cap = block.html.exec(src);
    if (cap) {
      const raw = trimTrailingBlankLines(cap[0]);
      return { type: 'html', block: true, raw, pre: cap[1] === 'pre' || cap[1] === 'script' || cap[1] === 'style', text: raw };
    }
  }

  def(src) {
    const cap = block.def.exec(src);
    if (!cap) return;
    if (!other.startAngleBracket.test(cap[2]) && findClosingBracket(cap[2], '()') !== -1) return;
    return {
      type: 'def',
      tag: normalizeLabel(cap[1]),
      raw: stripTrailing(cap[0], '\n'),
      href: cap[2] ? cap[2].replace(other.hrefBrackets, '$1').replace(inline.anyPunctuation, '$1') : '',
      title: cap[3] ? cap[3].substring(1, cap[3].length - 1).replace(inline.anyPunctuation, '$1') : cap[3],
    };
  }

  table(src) {
    const cap = block.table.exec(src);
    if (!cap || !other.tableDelimiter.test(cap[2])) return;
    const header = splitRow(cap[1]);
    const aligns = cap[2].replace(other.tableAlignChars, '').split('|');
    const rows = cap[3] && cap[3].trim() ? cap[3].replace(other.tableRowBlankLine, '').split('\n') : [];
    const token = { type: 'table', raw: stripTrailing(cap[0], '\n'), header: [], align: [], rows: [] };
    if (header.length !== aligns.length) return;
    for (const cell of aligns) {
      if (other.tableAlignRight.test(cell)) token.align.push('right');
      else if (other.tableAlignCenter.test(cell)) token.align.push('center');
      else if (other.tableAlignLeft.test(cell)) token.align.push('left');
      else token.align.push(null);
    }
    for (let i = 0; i < header.length; i++) {
      token.header.push({ text: header[i], tokens: this.lexer.inline(header[i]), header: true, align: token.align[i] });
    }
    for (const row of rows) {
      const cells = splitRow(row, token.header.length);
      const out = [];
      for (let i = 0; i < cells.length; i++) {
        out.push({ text: cells[i], tokens: this.lexer.inline(cells[i]), header: false, align: token.align[i] });
      }
      token.rows.push(out);
    }
    return token;
  }

  lheading(src) {
    const cap = block.lheading.exec(src);
    if (cap) {
      const text = cap[1].trim();
      return {
        type: 'heading',
        raw: stripTrailing(cap[0], '\n'),
        depth: cap[2].charAt(0) === '=' ? 1 : 2,
        text,
        tokens: this.lexer.inline(text),
      };
    }
  }

  paragraph(src) {
    const cap = block.paragraph.exec(src);
    if (cap) {
      const text = cap[1].charAt(cap[1].length - 1) === '\n' ? cap[1].slice(0, -1) : cap[1];
      return { type: 'paragraph', raw: cap[0], text, tokens: this.lexer.inline(text) };
    }
  }

  text(src) {
    const cap = block.text.exec(src);
    if (cap) return { type: 'text', raw: cap[0], text: cap[0], tokens: this.lexer.inline(cap[0]) };
  }
}

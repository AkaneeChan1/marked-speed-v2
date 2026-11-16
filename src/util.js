// Small helpers shared by the block and inline scanners. Each one is a port of the corresponding
// helper in marked 18.1.3 (MIT; see vendor/marked/LICENSE), kept behaviourally identical.

import { other } from './rules.js';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escChar = (c) => ESCAPES[c];

/** HTML-escape `html`. `encode` also escapes `&` that is not already a character reference. */
export function escape(html, encode) {
  if (encode) {
    if (other.escapeTest.test(html)) return html.replace(other.escapeReplace, escChar);
  } else if (other.escapeTestNoEncode.test(html)) {
    return html.replace(other.escapeReplaceNoEncode, escChar);
  }
  return html;
}

/** Decode numeric character references and escape bare ampersands, as marked's `Ie` does. */
export function unescapeEntities(text) {
  if (text.indexOf('&') === -1) return text;
  if (!other.numericCharacterReference.test(text)) return text;
  return text.replace(other.numericCharacterReferenceOrAmpersand, (m, dec, hex) => {
    if (dec === undefined && hex === undefined) return '&amp;';
    const code = dec === undefined ? Number.parseInt(hex, 16) : Number.parseInt(dec, 10);
    if (code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return '\uFFFD';
    if (code === 38) return '&amp;';
    return String.fromCodePoint(code);
  });
}

/** Percent-encode a URL the way marked does; null when encodeURI throws. */
export function encodeUrl(href) {
  try {
    href = encodeURI(href).replace(other.percentDecode, '%');
  } catch {
    return null;
  }
  return href;
}

/** Split a table row into cells, honouring `\|` and trimming. */
export function splitRow(row, count) {
  const escaped = row.replace(other.findPipe, (m, offset, str) => {
    let odd = false;
    let i = offset;
    while (--i >= 0 && str[i] === '\\') odd = !odd;
    return odd ? '|' : ' |';
  });
  const cells = escaped.split(other.splitPipe);
  if (!cells[0].trim()) cells.shift();
  if (cells.length > 0 && !cells[cells.length - 1].trim()) cells.pop();
  if (count) {
    if (cells.length > count) cells.splice(count);
    else while (cells.length < count) cells.push('');
  }
  for (let i = 0; i < cells.length; i++) cells[i] = cells[i].trim().replace(other.slashPipe, '|');
  return cells;
}

/** Strip trailing occurrences of `ch` (or non-`ch` when `invert`), as marked's `L`. */
export function stripTrailing(str, ch, invert) {
  const n = str.length;
  if (n === 0) return '';
  const code = ch.charCodeAt(0);
  let i = 0;
  while (i < n) {
    const c = str.charCodeAt(n - i - 1);
    if (c === code && !invert) i++;
    else if (c !== code && invert) i++;
    else break;
  }
  return str.slice(0, n - i);
}

/** Drop trailing blank lines, keeping the string as-is when at most two lines would go. */
export function trimTrailingBlankLines(src) {
  const lines = src.split('\n');
  let last = lines.length - 1;
  while (last >= 0 && other.blankLine.test(lines[last])) last--;
  if (lines.length - last <= 2) return src;
  return lines.slice(0, last + 1).join('\n');
}

/** Normalise a link label: trim, collapse whitespace, case-fold. */
export function normalizeLabel(label) {
  // Fast path: an already-normalised ASCII label needs none of the three passes.
  let plain = true;
  for (let i = 0; i < label.length; i++) {
    const c = label.charCodeAt(i);
    if (c >= 128 || c === 32 || c === 9 || c === 10 || c === 13 || c === 12 || (c >= 65 && c <= 90)) {
      plain = false;
      break;
    }
  }
  if (plain) return label;
  return label.trim().replace(other.multipleSpaceGlobal, ' ').toLowerCase().toUpperCase().toLowerCase();
}

/** Index of the bracket that closes the one at the start of `str`, or -1 / -2. */
export function findClosingBracket(str, pair) {
  const open = pair.charCodeAt(0);
  const close = pair.charCodeAt(1);
  if (str.indexOf(pair[0]) === -1 && str.indexOf(pair[1]) === -1) return -1;
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c === 92) i++;
    else if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth < 0) return i;
    }
  }
  return depth > 0 ? -2 : -1;
}

/** Expand tabs to 4-column stops, starting at column `start`. */
export function expandTabs(str, start = 0) {
  if (str.indexOf('\t') === -1) return str;
  let col = start;
  let out = '';
  let last = 0;
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) === 9) {
      out += str.slice(last, i);
      const width = 4 - (col % 4);
      out += ' '.repeat(width);
      col += width;
      last = i + 1;
    } else {
      col++;
    }
  }
  return out + str.slice(last);
}

/** Remove the fence's own indentation from every line of a fenced code block. */
export function compensateIndent(raw, text, rules) {
  const m = raw.match(rules.other.indentCodeCompensation);
  if (m === null) return text;
  const indent = m[1];
  return text
    .split('\n')
    .map((line) => {
      const lead = line.match(rules.other.beginningSpace);
      if (lead === null) return line;
      return line.slice(Math.min(lead[0].length, indent.length));
    })
    .join('\n');
}

/** marked's `Be`: true when a link's label contains a tag/autolink that would swallow the link. */
export function linkInLabel(src, label, offset, rules) {
  if (!label.includes('<')) return false;
  for (let i = 0; i < label.length; i++) {
    const c = label.charCodeAt(i);
    if (c === 92) {
      i++;
      continue;
    }
    if (c === 96) {
      const m = rules.inline.code.exec(label.slice(i));
      if (m) {
        i += m[0].length - 1;
        continue;
      }
    }
    if (c !== 60) continue;
    const rest = src.slice(offset + i);
    const m = rules.inline.tag.exec(rest) || rules.inline.autolink.exec(rest);
    if (m) {
      if (m[0].length > label.length - i) return true;
      i += m[0].length - 1;
    }
  }
  return false;
}

/** Code-point length of a string (marked spreads it into an array). */
export function cpLen(str) {
  let n = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      const d = str.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) i++;
    }
    n++;
  }
  return n;
}

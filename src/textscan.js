// A hand-written replacement for marked's inline `text` rule.
//
// The rule is
//   ^(?:[^a-zA-Z0-9](?=(?:mailto|xmpp):)
//     |(`+|~+|[^`~])(?:(?=[`~])|(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{|}~-]+@)
//                    |[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|[hH][tT][tT][pP][sS]?|[fF][tT][pP]:\/\/
//                                |(?<![^\s*_~(])www\.|$)
//                              |[^ ](?= {2,}\n)
//                              |[^a-zA-Z0-9](?=(?:mailto|xmpp):)
//                              |[^a-zA-Z0-9.!#$%&'*+\/=?_`{|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{|}~-]+@))))
// and `scanText` returns the length of the same match. The scan is a tight loop over a
// per-character class table, so ordinary prose costs one table load per character.

const BACKTICK = 96;
const TILDE = 126;
const SPACE = 32;
const NEWLINE = 10;
const AT = 64;
const COLON = 58;

/** Characters that end a text run because another inline rule can start there: \ < ! [ ` * ~ _ */
const STOP = new Uint8Array(128);
for (const c of [92, 60, 33, 91, 96, 42, 126, 95]) STOP[c] = 1;

/** [a-zA-Z0-9.!#$%&'*+/=?_`{|}~-] */
const EMAILCH = new Uint8Array(128);
for (let c = 48; c <= 57; c++) EMAILCH[c] = 1;
for (let c = 65; c <= 90; c++) EMAILCH[c] = 1;
for (let c = 97; c <= 122; c++) EMAILCH[c] = 1;
for (const c of [46, 33, 35, 36, 37, 38, 39, 42, 43, 47, 61, 63, 95, 96, 123, 124, 125, 126, 45]) EMAILCH[c] = 1;

/** [a-zA-Z0-9] */
const ALNUM = new Uint8Array(128);
for (let c = 48; c <= 57; c++) ALNUM[c] = 1;
for (let c = 65; c <= 90; c++) ALNUM[c] = 1;
for (let c = 97; c <= 122; c++) ALNUM[c] = 1;

// "Interesting" tables: a character that cannot possibly end the run is skipped with one load.
// The extra variants are used when the text contains '@' or ':' and the e-mail / autolink
// alternatives therefore have to be considered at every non-alphanumeric character.
const T_BASIC = new Uint8Array(128);
for (const c of [92, 60, 33, 91, 96, 42, 126, 95, 104, 72, 102, 70, 119, SPACE]) T_BASIC[c] = 1;
const T_AT = T_BASIC.slice();
const T_COLON = T_BASIC.slice();
const T_BOTH = T_BASIC.slice();
for (let c = 0; c < 128; c++) {
  if (!EMAILCH[c]) {
    T_AT[c] = 1;
    T_BOTH[c] = 1;
  }
  if (!ALNUM[c]) {
    T_COLON[c] = 1;
    T_BOTH[c] = 1;
  }
}

function startsWithAt(src, q, lit) {
  const n = src.length;
  if (q + lit.length > n) return false;
  for (let i = 0; i < lit.length; i++) {
    if (src.charCodeAt(q + i) !== lit.charCodeAt(i)) return false;
  }
  return true;
}

/** ` {2,}\n` at q */
function twoSpacesThenNl(src, q) {
  const n = src.length;
  if (q + 2 >= n) return false;
  if (src.charCodeAt(q) !== SPACE || src.charCodeAt(q + 1) !== SPACE) return false;
  let i = q + 2;
  while (i < n && src.charCodeAt(i) === SPACE) i++;
  return i < n && src.charCodeAt(i) === NEWLINE;
}

/** `[a-zA-Z0-9.!#$%&'*+/=?_`{|}~-]+@` at q */
function emailThenAt(src, q) {
  const n = src.length;
  let i = q;
  while (i < n) {
    const c = src.charCodeAt(i);
    if (c < 128 && EMAILCH[c]) i++;
    else break;
  }
  return i > q && i < n && src.charCodeAt(i) === AT;
}

/** `[hH][tT][tT][pP][sS]?` at p */
function httpAt(src, p) {
  if (p + 4 > src.length) return false;
  const a = src.charCodeAt(p);
  const b = src.charCodeAt(p + 1);
  const c = src.charCodeAt(p + 2);
  const d = src.charCodeAt(p + 3);
  return (a === 104 || a === 72) && (b === 116 || b === 84) && (c === 116 || c === 84) && (d === 112 || d === 80);
}

/** `[fF][tT][pP]:\/\/` at p */
function ftpAt(src, p) {
  if (p + 6 > src.length) return false;
  const a = src.charCodeAt(p);
  const b = src.charCodeAt(p + 1);
  const c = src.charCodeAt(p + 2);
  return (
    (a === 102 || a === 70) &&
    (b === 116 || b === 84) &&
    (c === 112 || c === 80) &&
    src.charCodeAt(p + 3) === COLON &&
    src.charCodeAt(p + 4) === 47 &&
    src.charCodeAt(p + 5) === 47
  );
}

/** `(?<![^\s*_~(])www\.` at p */
function wwwAt(src, p) {
  if (p + 4 > src.length) return false;
  if (src.charCodeAt(p) !== 119 || src.charCodeAt(p + 1) !== 119 || src.charCodeAt(p + 2) !== 119) return false;
  if (src.charCodeAt(p + 3) !== 46) return false;
  if (p === 0) return true;
  const prev = src.charCodeAt(p - 1);
  return (
    prev === SPACE ||
    prev === 9 ||
    prev === NEWLINE ||
    prev === 13 ||
    prev === 12 ||
    prev === 42 ||
    prev === 95 ||
    prev === 126 ||
    prev === 40
  );
}

export function scanText(src) {
  const n = src.length;
  if (n === 0) return 0;
  const c0 = src.charCodeAt(0);

  // Alternative A: one non-alphanumeric character before mailto:/xmpp:
  if ((c0 >= 128 || !ALNUM[c0]) && (src.charCodeAt(1) === 109 || src.charCodeAt(1) === 120)) {
    if (startsWithAt(src, 1, 'mailto:') || startsWithAt(src, 1, 'xmpp:')) return 1;
  }

  // Alternative B: a run of backticks or tildes, or a single other character
  let i = 1;
  if (c0 === BACKTICK || c0 === TILDE) {
    while (i < n && src.charCodeAt(i) === c0) i++;
  }

  // The group that must follow the first character
  if (i < n) {
    const c = src.charCodeAt(i);
    if (c === BACKTICK || c === TILDE) return i;
    if (c === SPACE && twoSpacesThenNl(src, i)) return i;
    if (c < 128 && EMAILCH[c] && emailThenAt(src, i)) return i;
  }

  // [\s\S]*?(?:S1|S2|S3|S4)
  const hasAt = src.indexOf('@') !== -1;
  const hasColon = src.indexOf(':') !== -1;
  const T = hasAt ? (hasColon ? T_BOTH : T_AT) : hasColon ? T_COLON : T_BASIC;
  let p = i;
  while (p < n) {
    const c = src.charCodeAt(p);
    if (c < 128) {
      if (T[c] === 0) {
        p++;
        continue;
      }
      if (STOP[c]) return p;
      if (c === 104 || c === 72) {
        if (httpAt(src, p)) return p;
      } else if (c === 102 || c === 70) {
        if (ftpAt(src, p)) return p;
      } else if (c === 119) {
        if (wwwAt(src, p)) return p;
      } else if (c === SPACE) {
        // S2: a non-space character followed by two spaces and a newline
        if (p > i && src.charCodeAt(p - 1) !== SPACE && src.charCodeAt(p + 1) === SPACE && twoSpacesThenNl(src, p)) {
          return p;
        }
      }
      // S3: a non-alphanumeric character before mailto:/xmpp:
      if (hasColon && !ALNUM[c] && (startsWithAt(src, p + 1, 'mailto:') || startsWithAt(src, p + 1, 'xmpp:'))) {
        return p + 1;
      }
      // S4: a non-e-mail character before an e-mail local part
      if (hasAt && !EMAILCH[c]) {
        const d = src.charCodeAt(p + 1);
        if (d < 128 && EMAILCH[d] && emailThenAt(src, p + 1)) return p + 1;
      }
    } else {
      // Non-ASCII: not a stop character, not alphanumeric, not an e-mail character.
      if (hasColon && (startsWithAt(src, p + 1, 'mailto:') || startsWithAt(src, p + 1, 'xmpp:'))) return p + 1;
      if (hasAt) {
        const d = src.charCodeAt(p + 1);
        if (d < 128 && EMAILCH[d] && emailThenAt(src, p + 1)) return p + 1;
      }
    }
    p++;
  }
  return n;
}

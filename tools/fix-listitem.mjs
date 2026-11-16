// One-off: rewrite the listItemRegex factory so its character class is a real tab + space.
import { readFileSync, writeFileSync } from 'node:fs';

const TAB = String.fromCharCode(9);
const line =
  "export const listItemRegex = (b) => new RegExp('^( {0,3}' + b + ')((?:[" +
  TAB +
  " ][^\\\\n]*)?(?:\\\\n|$))');";

const path = new URL('../src/rules.js', import.meta.url);
const lines = readFileSync(path, 'utf8').split('\n');
let hit = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('export const listItemRegex')) {
    lines[i] = line;
    hit++;
  }
}
writeFileSync(path, lines.join('\n'));
console.log('rewrote', hit, 'line(s)');
console.log(JSON.stringify(line));

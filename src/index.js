// parse(markdown): the HTML marked 18.1.3 renders for it with its default options
// (gfm on, breaks off, pedantic off, async off).
//
// One Lexer and one Parser are created at load time and reset per call, so a document costs no
// object graph construction beyond its own tokens.

import { Lexer } from './lexer.js';
import { Parser } from './parser.js';

const lexer = new Lexer();
const parser = new Parser();

export function parse(markdown) {
  lexer.reset();
  return parser.parse(lexer.lex(markdown));
}

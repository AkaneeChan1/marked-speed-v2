// The entry point: parse(markdown) returns the HTML marked 18.1.3 renders with its default options
// (gfm on, breaks off, pedantic off, async off). The implementation is our own scanner, block
// parser and renderer under src/; vendor/marked is kept only as the reference the checkers compare
// against, and is not imported here.

export { parse } from './src/index.js';

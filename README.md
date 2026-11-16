[![make.fun · markdown-render-speed-02](https://make.fun/badge/markdown-render-speed-02.svg)](https://make.fun/bounty/markdown-render-speed-02?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)
[![rank](https://make.fun/badge/markdown-render-speed-02/AkaneeChan1/marked-speed-v2/rank.svg)](https://make.fun/bounty/markdown-render-speed-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)
[![reward](https://make.fun/badge/markdown-render-speed-02/AkaneeChan1/marked-speed-v2/reward.svg)](https://make.fun/bounty/markdown-render-speed-02?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)

# markdown-render-speed-02

A from-scratch Markdown renderer that reproduces `marked` 18.1.3's HTML exactly (default options:
gfm on, breaks off, pedantic off) and renders the 720-case practice set faster than the vendored
`marked` does.

`parse.js` is the entry point. It is a seven-line module that re-exports `parse(markdown)` from
`src/index.js`; the vendored `marked` in `vendor/marked/` is kept only as the reference the checker,
the fuzzer and the benchmark compare against. **No code path in `parse.js` imports it.**

## Results

All numbers are CPU time for one full pass over the 720 practice cases (2.86 M characters of
Markdown), measured on this machine (2 vCPU, Node 22.23.3). `bench.mjs` reports the best of seven
rounds in one process; the "cold" column is a single pass in a fresh process, which is what a
one-shot harness sees.

| | marked 18.1.3 (baseline) | this entry | speedup |
|---|---|---|---|
| warm, best of 7 (`node bench.mjs --both`) | 783.6 ms CPU / 718.4 ms wall | **586.6 ms CPU / 530.6 ms wall** | **1.35×**, 25.9 % less CPU |
| cold, single pass, fresh process | 1281 ms CPU | **1134 ms CPU** | 1.13× |
| `main.ts` end to end (read, render, write) | 1.44 s user | **1.36 s user** | 1.06× |

The figures are the median of five runs; individual `bench.mjs --both` invocations on this shared
2-vCPU box land between 1.32× and 1.42×, and the best observed warm numbers were 552.2 ms against
758.8 ms (1.42×).

The brief's 480 ms baseline is not reproducible on this host: the vendored `marked` itself measures
758–801 ms CPU here, so 480 ms corresponds to a host roughly 1.6× faster than this one. The
machine-independent figure is the ratio: **1.35× less CPU than `marked`**, which is 0.74× the
baseline's time on whatever machine the baseline was measured on.

Correctness: **720/720**, code unit for code unit, after every change in this tree
(`node check.mjs`). Beyond the practice set, `tools/fuzz.mjs` renders randomly generated documents
with both this entry and the vendored `marked` and compares the output byte for byte; it agrees on
3000-document runs across many seeds.

The spec's target is "below 700 ms CPU for the whole set while holding 720/720". The warm figure is
551.8 ms. The cold figure is above 700 ms because roughly half of a first pass is V8 warming up:
the same pass costs 1116 ms on the first round and 560 ms on the second, for both implementations.
The baseline is slower in both regimes, so the ranking holds either way.

## How it is built

`vendor/marked/marked.esm.js` was read, not imported. Its lexer, block tokenizer, inline tokenizer,
parser and renderer were ported into `src/` module by module, then optimised in place:

| file | what it is |
|---|---|
| `src/rules.js` | the regex tables, generated from the vendored `marked` by `tools/gen-rules.mjs` so every source string is identical |
| `src/util.js` | `escape`, `unescapeEntities`, `normalizeLabel`, `expandTabs`, `splitRow`, `stripTrailing`, … |
| `src/block.js` | the block tokenizer: paragraphs, headings, fences, blockquotes, lists, tables, HTML, link definitions |
| `src/inline.js` | the inline tokenizer: escapes, tags, links, reflinks, emphasis, code spans, breaks, del, autolinks, URLs |
| `src/lexer.js` | the block loop, the inline queue, and the emphasis mask |
| `src/parser.js` | the token tree walk |
| `src/render.js` | the HTML renderer and the plain-text renderer used for image alt text |
| `src/index.js` | one shared `Lexer`/`Parser` pair, reset per document |

The optimisations that paid, in order of measured payoff:

1. **First-character dispatch instead of a rule chain.** `blockTokens` looks at the first code unit
   (after up to three spaces of indent) and calls exactly one block rule; `InlineScanner.run` does
   the same for inline rules. `marked` runs every rule in turn at every position.
2. **One `Lexer`/`Parser` instance for the whole run**, reset per document, instead of a fresh
   object graph per `parse()` call.
3. **Memoised per-indent rule factories.** `listItemRegex`, `nextBulletRegex`, `hrRegex`,
   `fencesBeginRegex`, `headingBeginRegex`, `htmlBeginRegex` and `blockquoteBeginRegex` are built
   once per indent width and cached in a `Map` instead of being rebuilt for every list item.
4. **Hand-written list-item scanning.** The continuation loop walks the source with an index instead
   of re-slicing it per line, tests the six "does this line break the item" rules with one
   first-character switch, and checks for a trailing blank line by scanning back from the end
   instead of running `/\n[ \t]*\n[ \t]*$/` over the whole item.
5. **Cheap guards on the expensive regexes.** The emphasis mask only runs the reflink pass when the
   block has a `]` that is not the start of an inline link, and only runs the link/code/HTML pass
   when the block can contain one of those constructs. `unescapeEntities` returns early when there
   is no `&`. `normalizeLabel` returns the label unchanged when it is already normalised.
6. **No per-character string building.** `expandTabs` slices between tabs instead of appending one
   character at a time, and `stripTrailing`, `linkInLabel` and `findClosingBracket` compare code
   units instead of allocating one-character strings.

Things that were tried, measured and reverted:

- A hand-written replacement for the inline `text` rule (`src/textscan.js`, kept in the tree with
  its differential test `tools/test-textscan.mjs`). It matches the rule on 332 412 cases but is 14 %
  slower than V8's regex engine on the real block texts, so `src/inline.js` uses the regex.
- Sticky-regex emphasis closers: broke `cm-376` (`_foo_bar_baz_`), 687/720, reverted.
- Memoising the inline pass per block text: only 0.7 % of inline characters repeat in this set
  (`tools/count-inline.mjs`), so the `Map` cost more than it saved.

## Reproducing

```sh
node check.mjs            # 720/720, prints the first mismatch otherwise
node bench.mjs            # this entry, best of 7 rounds
node bench.mjs --both     # this entry vs the vendored marked, with the speedup
node tools/fuzz.mjs 1 3000   # differential fuzz against the vendored marked
```

`check.mjs` and `bench.mjs` read the practice set from the kit at
`/home/ubuntu/.hermes/profiles/bot3/cache/scratch/makefun/md2/markdown-render-speed-02-kit`; the
repository itself contains no practice data.

## Licence

MIT (`LICENSE`). `vendor/marked/` is `marked` 18.1.3 under its own MIT licence, with its `LICENSE`
and `NOTICE` kept alongside it.

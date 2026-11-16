// CPU benchmark of the parse loop over the practice set.
//
//   node bench.mjs              # warm: best of 7 rounds, CPU time of the parse loop
//   node bench.mjs --both       # same, for our parse() and for the vendored marked, back to back
//   node bench.mjs --cold       # cold: one fresh process per sample, CPU time of the whole run
//
// The parse loop is exactly what main.ts does: for each case, parse(markdown). Loading the input
// and the reference is outside the timed region. CPU time (process.cpuUsage) is used rather than
// wall time so that other load on the machine does not move the number.

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const KIT = '/home/ubuntu/.hermes/profiles/bot3/cache/scratch/makefun/md2/markdown-render-speed-02-kit';
const cases = JSON.parse(readFileSync(`${KIT}/practice/input/cases.json`, 'utf8'));
const markdowns = cases.map((c) => c.markdown);
const ROUNDS = 7;

if (process.argv.includes('--cold')) {
  const self = fileURLToPath(import.meta.url);
  const samples = [];
  for (let i = 0; i < 7; i++) {
    const r = spawnSync(process.execPath, [self, '--one'], { encoding: 'utf8' });
    const m = /cpu=([\d.]+)/.exec(r.stdout);
    if (m) samples.push(Number(m[1]));
  }
  samples.sort((a, b) => a - b);
  console.log(`cold cpu min ${samples[0].toFixed(1)} ms  (samples ${samples.map((s) => s.toFixed(0)).join(' ')})`);
  process.exit(0);
}

const impl = process.argv.includes('--both') ? 'both' : 'ours';
const ours = (await import('./parse.js')).parse;
const marked = impl === 'both' ? (await import('./vendor/marked/marked.esm.js')).marked.parse : null;

if (process.argv.includes('--one')) {
  const t0 = process.cpuUsage();
  for (let i = 0; i < markdowns.length; i++) ours(markdowns[i]);
  const d = process.cpuUsage(t0);
  console.log(`cpu=${((d.user + d.system) / 1000).toFixed(1)}`);
  process.exit(0);
}

function measure(fn) {
  for (let i = 0; i < markdowns.length; i++) fn(markdowns[i]); // warm-up
  let bestCpu = Infinity;
  let bestWall = Infinity;
  for (let r = 0; r < ROUNDS; r++) {
    const c0 = process.cpuUsage();
    const w0 = process.hrtime.bigint();
    for (let i = 0; i < markdowns.length; i++) fn(markdowns[i]);
    const wall = Number(process.hrtime.bigint() - w0) / 1e6;
    const d = process.cpuUsage(c0);
    const cpu = (d.user + d.system) / 1000;
    if (cpu < bestCpu) bestCpu = cpu;
    if (wall < bestWall) bestWall = wall;
  }
  return { cpu: bestCpu, wall: bestWall };
}

const a = measure(ours);
console.log(`ours   cpu ${a.cpu.toFixed(1)} ms   wall ${a.wall.toFixed(1)} ms   (best of ${ROUNDS}, ${markdowns.length} cases)`);
if (marked) {
  const b = measure(marked);
  console.log(`marked cpu ${b.cpu.toFixed(1)} ms   wall ${b.wall.toFixed(1)} ms   (best of ${ROUNDS}, ${markdowns.length} cases)`);
  console.log(`speedup ${(b.cpu / a.cpu).toFixed(2)}x  (${(100 * (1 - a.cpu / b.cpu)).toFixed(1)}% less CPU)`);
}

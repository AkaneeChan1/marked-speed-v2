// Summarise a .cpuprofile: self time by function, and by function+file.
import { readFileSync, readdirSync } from 'node:fs';

const dir = process.argv[2] || '/tmp/prof';
const file = readdirSync(dir).filter((f) => f.endsWith('.cpuprofile')).sort().pop();
const prof = JSON.parse(readFileSync(dir + '/' + file, 'utf8'));

const byId = new Map();
for (const n of prof.nodes) byId.set(n.id, n);
const self = new Map();
for (let i = 0; i < prof.samples.length; i++) {
  const id = prof.samples[i];
  const dt = prof.timeDeltas[i] || 0;
  self.set(id, (self.get(id) || 0) + dt);
}
const total = [...self.values()].reduce((a, b) => a + b, 0);
const agg = new Map();
for (const [id, us] of self) {
  const n = byId.get(id);
  if (!n) continue;
  const cf = n.callFrame;
  const key = (cf.functionName || '(anonymous)') + '  ' + (cf.url || '').split('/').pop() + ':' + cf.lineNumber;
  agg.set(key, (agg.get(key) || 0) + us);
}
const rows = [...agg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
console.log('total us', total.toFixed(0));
for (const [k, us] of rows) {
  console.log((us / 1000).toFixed(1).padStart(8) + ' ms  ' + ((100 * us) / total).toFixed(1).padStart(5) + '%  ' + k);
}

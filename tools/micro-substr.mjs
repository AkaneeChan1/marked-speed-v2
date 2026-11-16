// Is `substring` + anchored regex slower than a sticky regex on the full string?
const N = 200000;
const base = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor '.repeat(200);
const re = /^[^`~]+/;
const sticky = /[^`~]+/y;

function a() {
  let s = base;
  let n = 0;
  while (s.length > 0) {
    const m = re.exec(s);
    if (!m) break;
    n += m[0].length;
    s = s.substring(m[0].length);
  }
  return n;
}
function b() {
  let pos = 0;
  let n = 0;
  while (pos < base.length) {
    sticky.lastIndex = pos;
    const m = sticky.exec(base);
    if (!m) break;
    n += m[0].length;
    pos += m[0].length;
  }
  return n;
}
for (let i = 0; i < 3; i++) {
  a();
  b();
}
let t = process.hrtime.bigint();
for (let i = 0; i < N; i++) a();
const ta = Number(process.hrtime.bigint() - t) / 1e6;
t = process.hrtime.bigint();
for (let i = 0; i < N; i++) b();
const tb = Number(process.hrtime.bigint() - t) / 1e6;
console.log({ substringMs: ta.toFixed(0), stickyMs: tb.toFixed(0), ratio: (ta / tb).toFixed(2) });

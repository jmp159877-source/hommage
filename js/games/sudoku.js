// 스도쿠 — 하루 한 판(모두 같은 판). 가로·세로·굵은 칸 안에 1~9가 한 번씩.
import * as P from '../play.js';
import { todayKey } from '../db.js';
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const ok = (g, i, v) => { const r = Math.floor(i / 9), c = i % 9, br = r - r % 3, bc = c - c % 3; for (let k = 0; k < 9; k++) { if (g[r * 9 + k] === v || g[k * 9 + c] === v || g[(br + Math.floor(k / 3)) * 9 + bc + k % 3] === v) return false; } return true; };
function fill(g, R) { const i = g.indexOf(0); if (i < 0) return true; const vs = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => R() - 0.5); for (const v of vs) { if (ok(g, i, v)) { g[i] = v; if (fill(g, R)) return true; g[i] = 0; } } return false; }
function count(g, lim = 2) { const i = g.indexOf(0); if (i < 0) return 1; let n = 0; for (let v = 1; v <= 9 && n < lim; v++) if (ok(g, i, v)) { g[i] = v; n += count(g, lim - n); g[i] = 0; } return n; }
export function make(day, givens = 32) {
  const R = rng(+day.replace(/-/g, '') * 7 + 3), sol = Array(81).fill(0); fill(sol, R);
  const puz = sol.slice(), order = [...Array(81).keys()].sort(() => R() - 0.5); let left = 81;
  for (const i of order) { if (left <= givens) break; const v = puz[i]; puz[i] = 0; if (count(puz.slice()) !== 1) puz[i] = v; else left--; }
  return { sol, puz };
}
export function mount(el) {
  const T = P.shell(el, 'sudoku'), day = todayKey(), { sol, puz } = make(day), key = 'sudoku.' + day;
  const st = P.store.get(key, null) || { cur: puz.slice(), mis: 0, ms: 0, done: false };
  let sel = -1;
  T.body.innerHTML = `<div class="sd-grid" id="sd-grid"></div><div class="sd-pad" id="sd-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button type="button" data-n="${n}">${n}</button>`).join('')}<button type="button" data-n="0" class="wide">지우기</button></div><p class="note sd-tip">칸을 고르고 숫자를 누르세요. 틀린 숫자는 빨갛게 보이고 20초가 더해져요.</p>`;
  const G = T.body.querySelector('#sd-grid');
  function draw() {
    const sv = sel >= 0 ? st.cur[sel] : 0;
    G.innerHTML = st.cur.map((v, i) => { const r = Math.floor(i / 9), c = i % 9, s = sel >= 0 ? [Math.floor(sel / 9), sel % 9] : [-9, -9];
      const same = sel >= 0 && (r === s[0] || c === s[1] || (Math.floor(r / 3) === Math.floor(s[0] / 3) && Math.floor(c / 3) === Math.floor(s[1] / 3)));
      const cls = ['sd', puz[i] ? 'given' : '', v && v !== sol[i] ? 'bad' : '', i === sel ? 'sel' : same ? 'near' : '', sv && v === sv && i !== sel ? 'samev' : '', c % 3 === 2 && c < 8 ? 'br' : '', r % 3 === 2 && r < 8 ? 'bb' : ''].filter(Boolean).join(' ');
      return `<button type="button" class="${cls}" data-i="${i}">${v || ''}</button>`; }).join('');
  }
  G.onclick = e => { const b = e.target.closest('[data-i]'); if (!b || st.done) return; sel = +b.dataset.i; if (!T.running()) { T.start(); T.add(st.ms); } P.sfx('tap'); draw(); };
  T.body.querySelector('#sd-pad').onclick = e => {
    const b = e.target.closest('[data-n]'); if (!b || sel < 0 || st.done || puz[sel]) return; const n = +b.dataset.n;
    if (!T.running()) { T.start(); T.add(st.ms); }
    st.cur[sel] = n; if (n && n !== sol[sel]) { st.mis++; T.add(20000); P.sfx('bad'); } else if (n) P.sfx('ok');
    st.ms = T.ms(); P.store.set(key, st); draw();
    if (st.cur.every((v, i) => v === sol[i])) { st.done = true; const ms = T.stop(); st.ms = ms; P.store.set(key, st); P.sfx('win'); sel = -1; draw(); P.finish('sudoku', ms, P.fmtKo(ms) + (st.mis ? ` (실수 ${st.mis})` : ''), T.body); }
  };
  window.addEventListener('pagehide', () => { if (!st.done && T.running()) { st.ms = T.ms(); P.store.set(key, st); } });
  draw();
  if (st.done) T.body.insertAdjacentHTML('beforeend', `<p class="pl-done-t" style="text-align:center">오늘 판은 다 풀었어요 · ${P.fmtKo(st.ms)}</p>`);
}

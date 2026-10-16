// 스도쿠 — 오늘 판(모두 같은 판) + 새 판 여러 번, 가장 좋은 기록이 순위에. 가로·세로·굵은 칸 안에 1~9가 한 번씩.
import * as P from '../play.js';
import { todayKey } from '../db.js';
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const ok = (g, i, v) => { const r = Math.floor(i / 9), c = i % 9, br = r - r % 3, bc = c - c % 3; for (let k = 0; k < 9; k++) { if (g[r * 9 + k] === v || g[k * 9 + c] === v || g[(br + Math.floor(k / 3)) * 9 + bc + k % 3] === v) return false; } return true; };
function fill(g, R) { const i = g.indexOf(0); if (i < 0) return true; const vs = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => R() - 0.5); for (const v of vs) { if (ok(g, i, v)) { g[i] = v; if (fill(g, R)) return true; g[i] = 0; } } return false; }
function count(g, lim = 2) { const i = g.indexOf(0); if (i < 0) return 1; let n = 0; for (let v = 1; v <= 9 && n < lim; v++) if (ok(g, i, v)) { g[i] = v; n += count(g, lim - n); g[i] = 0; } return n; }
export function make(day, givens = 32, seed) {
  const R = rng(seed != null ? seed : +day.replace(/-/g, '') * 7 + 3), sol = Array(81).fill(0); fill(sol, R);
  const puz = sol.slice(), order = [...Array(81).keys()].sort(() => R() - 0.5); let left = 81;
  for (const i of order) { if (left <= givens) break; const v = puz[i]; puz[i] = 0; if (count(puz.slice()) !== 1) puz[i] = v; else left--; }
  return { sol, puz };
}
export function mount(el, practice = false) {
  const root = el, T = P.shell(el, 'sudoku'), day = todayKey(), { sol, puz } = practice ? make(day, 32, Math.floor(Math.random() * 1e9)) : make(day), key = 'sudoku.' + day;
  const st = practice ? { cur: puz.slice(), mis: 0, ms: 0, done: false } : P.store.get(key, null) || { cur: puz.slice(), mis: 0, ms: 0, done: false };
  const save = () => { if (!practice) P.store.set(key, st); };
  let sel = -1;
  const fresh = !practice && !st.done && st.cur.every((v, i) => v === puz[i]);
  T.body.innerHTML = `${practice ? '<p class="pr-band">새 판 · 더 좋은 기록이 오늘 순위에 오릅니다 <button type="button" class="linkbtn" id="sd-today">오늘 판으로</button></p>' : fresh ? '<button type="button" class="pr-try" id="sd-prac">처음이세요? <b>연습 한 판</b> 먼저 해 보기 <small>오늘 판은 그대로 남아 있어요</small></button>' : ''}<div class="sd-grid" id="sd-grid"></div><div class="sd-pad" id="sd-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button type="button" data-n="${n}">${n}</button>`).join('')}<button type="button" data-n="0" class="wide">지우기</button></div>${st.done ? '' : '<button type="button" class="btn line sd-reset" id="sd-reset">지우고 다시 <small>· 시계는 계속 갑니다</small></button>'}<p class="note sd-tip">칸을 고르고 숫자를 누르세요. 틀린 숫자는 빨갛게 보이고 20초가 더해져요.</p>`;
  const q = id => T.body.querySelector(id);
  if (q('#sd-prac')) q('#sd-prac').onclick = () => mount(root, true);
  if (q('#sd-today')) q('#sd-today').onclick = () => mount(root, false);
  if (q('#sd-reset')) q('#sd-reset').onclick = () => { if (!confirm('적은 숫자를 모두 지우고 처음부터 풀까요? 시계는 계속 갑니다.')) return; st.cur = puz.slice(); if (T.running()) st.ms = T.ms(); save(); sel = -1; draw(); };
  const more = () => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn line pl-again'; b.innerHTML = '한 판 더 <small>· 더 좋은 기록이 순위에 오릅니다</small>'; b.onclick = () => mount(root, true); T.body.appendChild(b); };
  const G = T.body.querySelector('#sd-grid');
  function draw() {
    const sv = sel >= 0 ? st.cur[sel] : 0;
    G.innerHTML = st.cur.map((v, i) => { const r = Math.floor(i / 9), c = i % 9, s = sel >= 0 ? [Math.floor(sel / 9), sel % 9] : [-9, -9];
      const same = sel >= 0 && (r === s[0] || c === s[1] || (Math.floor(r / 3) === Math.floor(s[0] / 3) && Math.floor(c / 3) === Math.floor(s[1] / 3)));
      const cls = ['sd', puz[i] ? 'given' : '', v && v !== sol[i] ? 'bad' : '', i === sel ? 'sel' : same ? 'near' : '', sv && v === sv && i !== sel ? 'samev' : '', c % 3 === 2 && c < 8 ? 'br' : '', r % 3 === 2 && r < 8 ? 'bb' : ''].filter(Boolean).join(' ');
      return `<button type="button" class="${cls}" data-i="${i}">${v || ''}</button>`; }).join('');
  }
  G.onclick = e => { const b = e.target.closest('[data-i]'); if (!b || st.done || !T.running()) return; sel = +b.dataset.i; P.sfx('tap'); draw(); };
  T.body.querySelector('#sd-pad').onclick = e => {
    const b = e.target.closest('[data-n]'); if (!b || sel < 0 || st.done || puz[sel] || !T.running()) return; const n = +b.dataset.n;
    if (q('#sd-prac')) q('#sd-prac').remove();
    st.cur[sel] = n; if (n && n !== sol[sel]) { st.mis++; T.add(20000); P.sfx('bad'); } else if (n) P.sfx('ok');
    st.ms = T.ms(); save(); draw();
    if (st.cur.every((v, i) => v === sol[i])) { st.done = true; const ms = T.stop(); st.ms = ms; save(); P.sfx('win'); sel = -1; draw(); if (q('#sd-reset')) q('#sd-reset').remove(); P.finish('sudoku', ms, P.fmtKo(ms) + (st.mis ? ` (실수 ${st.mis})` : ''), T.body); /* 몇 판을 하든 가장 좋은 기록이 순위에 */ more(); }
  };
  window.addEventListener('pagehide', () => { if (!st.done && T.running()) { st.ms = T.ms(); save(); } });
  draw();
  if (!st.done) T.countdown(null, st.ms || 0, G);
  if (st.done) { T.body.insertAdjacentHTML('beforeend', `<p class="pl-done-t" style="text-align:center">오늘 판은 다 풀었어요 · ${P.fmtKo(st.ms)}</p>`); more(); }
}

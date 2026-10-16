// 사천성 — 같은 그림 두 장을 꺾임 두 번 이하의 길로 이어 없앤다. 오늘 판(모두 같은 판) + 새 판 여러 번, 가장 좋은 기록이 순위에, 한 화면에 다 보이게.
import * as P from '../play.js';
import { todayKey } from '../db.js';
const ICONS = ['🍁', '🌸', '🌻', '🍀', '🌷', '🍄', '🌼', '🍇', '🌹', '🍋', '🐚', '🍒'];
const SR = 8, SC = 6;
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function path(B, r1, c1, r2, c2) {
  const H = SR + 2, W = SC + 2, D = [[-1, 0], [1, 0], [0, -1], [0, 1]], best = Array.from({ length: H }, () => Array.from({ length: W }, () => [9, 9, 9, 9])), q = [];
  for (let d = 0; d < 4; d++) q.push([r1, c1, d, 0, [[r1, c1]]]);
  while (q.length) {
    const [r, c, d, t, p] = q.shift(), nr = r + D[d][0], nc = c + D[d][1];
    if (nr < 0 || nc < 0 || nr >= H || nc >= W) continue;
    if (nr === r2 && nc === c2) return p.concat([[nr, nc]]);
    if (B[nr][nc]) continue;
    for (let nd = 0; nd < 4; nd++) { const nt = t + (nd === d ? 0 : 1); if (nt > 2 || best[nr][nc][nd] <= nt) continue; best[nr][nc][nd] = nt; q.push([nr, nc, nd, nt, nd === d ? p : p.concat([[nr, nc]])]); }
  }
  return null;
}
function pairs(B) { const L = []; for (let r = 1; r <= SR; r++) for (let c = 1; c <= SC; c++) if (B[r][c]) L.push([r, c]); const out = []; for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const a = L[i], b = L[j]; if (B[a[0]][a[1]] === B[b[0]][b[1]] && path(B, a[0], a[1], b[0], b[1])) out.push([a, b]); } return out; }
function solvable(B0, R) { for (let tries = 0; tries < 6; tries++) { const B = B0.map(r => r.slice()); let left = SR * SC; while (left) { const ps = pairs(B); if (!ps.length) break; const [a, b] = ps[Math.floor(R() * ps.length)]; B[a[0]][a[1]] = B[b[0]][b[1]] = null; left -= 2; } if (!left) return true; } return false; }
export function make(day, seed) {
  for (let k = 0; k < 200; k++) {
    const R = rng((seed != null ? seed : +day.replace(/-/g, '') * 31) + k), arr = []; ICONS.forEach(ic => { for (let i = 0; i < 4; i++) arr.push(ic); });
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    const B = Array.from({ length: SR + 2 }, () => Array(SC + 2).fill(null)); let n = 0; for (let r = 1; r <= SR; r++) for (let c = 1; c <= SC; c++) B[r][c] = arr[n++];
    if (solvable(B, R)) return B;
  }
}
export function mount(el, practice = false) {
  const root = el, T = P.shell(el, 'shisen'), day = todayKey();
  let B, sel, left, shuf, hints;
  function ready() {
    T.reset(); B = practice ? make(day, Math.floor(Math.random() * 1e9)) : make(day); sel = null; left = SR * SC; shuf = 3; hints = 0;
    T.body.innerHTML = `${practice ? '<p class="pr-band">새 판 · 더 좋은 기록이 오늘 순위에 오릅니다 <button type="button" class="linkbtn" id="ss-today">오늘 판으로</button></p>' : ''}<div class="ss-board" id="ss-board"></div><div class="ss-bar"><button type="button" class="btn line" id="ss-hint">힌트 <small>+15초</small></button><button type="button" class="btn line" id="ss-shuf">섞기 (3) <small>+20초</small></button><button type="button" class="btn line" id="ss-new">처음부터</button></div><p class="note ss-tip">같은 그림 두 장을 이어 보세요. 꺾이는 곳은 두 번까지!</p>`;
    setTimeout(() => T.countdown(null, 0, T.body.querySelector('#ss-board')), 50);
    T.body.querySelector('#ss-hint').onclick = hint; T.body.querySelector('#ss-shuf').onclick = () => shuffle(true); T.body.querySelector('#ss-new').onclick = ready; const tb = T.body.querySelector('#ss-today'); if (tb) tb.onclick = () => mount(root, false);
    draw();
  }
  function fit() {
    const bd = T.body.querySelector('#ss-board'); if (!bd) return;
    const top = bd.getBoundingClientRect().top, below = 120, avail = (window.visualViewport ? visualViewport.height : innerHeight) - top - below;
    const tw = Math.max(34, (avail - 12 - (SR - 1) * 5) * 3 / (4 * SR)), w = Math.min(bd.parentElement.clientWidth, Math.floor(tw * SC + (SC - 1) * 5 + 12));
    bd.style.width = w + 'px'; const real = (w - 12 - (SC - 1) * 5) / SC; bd.style.setProperty('--fs', Math.round(Math.min(30, real * 0.55)) + 'px');
  }
  function draw() {
    const bd = T.body.querySelector('#ss-board'); bd.innerHTML = '';
    for (let r = 1; r <= SR; r++) for (let c = 1; c <= SC; c++) { const t = B[r][c], b = document.createElement('button'); b.type = 'button'; b.className = 'ss-t' + (t ? '' : ' gone') + (sel && sel[0] === r && sel[1] === c ? ' sel' : ''); b.textContent = t || ''; b.onclick = () => tap(r, c); bd.appendChild(b); }
    requestAnimationFrame(fit);
  }
  function line(p) {
    const bd = T.body.querySelector('#ss-board').getBoundingClientRect(), cw = (bd.width - 12 - 5 * (SC - 1)) / SC, ch = cw * 4 / 3;
    const pt = ([r, c]) => [bd.left + 6 + (c - 1) * (cw + 5) + cw / 2, bd.top + 6 + (r - 1) * (ch + 5) + ch / 2];
    const sv = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); sv.setAttribute('class', 'ss-line'); sv.setAttribute('width', innerWidth); sv.setAttribute('height', innerHeight);
    const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); pl.setAttribute('points', p.map(pt).map(a => a.join(',')).join(' '));
    sv.appendChild(pl); document.body.appendChild(sv); setTimeout(() => sv.remove(), 280);
  }
  function tap(r, c) {
    if (!B[r][c] || !T.running()) return;
    if (!sel) { sel = [r, c]; P.sfx('tap'); draw(); return; }
    const [r0, c0] = sel;
    if (r0 === r && c0 === c) { sel = null; draw(); return; }
    if (B[r0][c0] !== B[r][c]) { sel = [r, c]; P.sfx('tap'); draw(); return; }
    const p = path(B, r0, c0, r, c);
    if (!p) { P.sfx('bad'); sel = [r, c]; draw(); return; }
    line(p); P.sfx('ok'); B[r0][c0] = B[r][c] = null; sel = null; left -= 2;
    setTimeout(() => {
      draw();
      if (!left) { const ms = T.stop(); P.sfx('win'); T.body.querySelector('#ss-board').style.display = 'none'; T.body.querySelector('.ss-bar').style.display = 'none'; P.finish('shisen', ms, P.fmtKo(ms), T.body); /* 몇 판을 하든 가장 좋은 기록이 순위에 */ const b = document.createElement('button'); b.type = 'button'; b.className = 'btn line pl-again'; b.innerHTML = '한 판 더 <small>· 더 좋은 기록이 순위에 오릅니다</small>'; b.onclick = () => mount(root, true); T.body.appendChild(b); return; }
      if (!pairs(B).length) shuffle(false);
    }, 240);
  }
  function hint() {
    const ps = pairs(B); if (!ps.length) return; if (!T.running()) T.start(); T.add(15000); hints++;
    draw(); const bd = T.body.querySelector('#ss-board'); ps[0].forEach(([r, c]) => bd.children[(r - 1) * SC + c - 1].classList.add('hint'));
  }
  function shuffle(byUser) {
    if (byUser) { if (shuf <= 0) return; shuf--; if (!T.running()) T.start(); T.add(20000); T.body.querySelector('#ss-shuf').innerHTML = `섞기 (${shuf}) <small>+20초</small>`; if (!shuf) T.body.querySelector('#ss-shuf').disabled = true; }
    const pos = [], vals = []; for (let r = 1; r <= SR; r++) for (let c = 1; c <= SC; c++) if (B[r][c]) { pos.push([r, c]); vals.push(B[r][c]); }
    for (let k = 0; k < 40; k++) { vals.sort(() => Math.random() - 0.5); pos.forEach(([r, c], i) => B[r][c] = vals[i]); if (pairs(B).length) break; }
    sel = null; P.sfx('flip'); draw();
  }
  window.addEventListener('resize', fit);
  ready();
}

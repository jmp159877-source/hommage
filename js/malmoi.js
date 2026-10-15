import * as P from './play.js';
// 말모이 — 하루 한 낱말. 두 글자 낱말을 자음·모음 여섯 칸으로 나눠 여섯 번 안에 맞히기.
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅗㅏ', 'ㅗㅐ', 'ㅗㅣ', 'ㅛ', 'ㅜ', 'ㅜㅓ', 'ㅜㅔ', 'ㅜㅣ', 'ㅠ', 'ㅡ', 'ㅡㅣ', 'ㅣ'];
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄱㅅ', 'ㄴ', 'ㄴㅈ', 'ㄴㅎ', 'ㄷ', 'ㄹ', 'ㄹㄱ', 'ㄹㅁ', 'ㄹㅂ', 'ㄹㅅ', 'ㄹㅌ', 'ㄹㅍ', 'ㄹㅎ', 'ㅁ', 'ㅂ', 'ㅂㅅ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const N = 6, TRIES = 6, START = Date.UTC(2026, 9, 16);
const KEYS = [['ㅂ', 'ㅈ', 'ㄷ', 'ㄱ', 'ㅅ', 'ㅛ', 'ㅕ', 'ㅑ'], ['ㅁ', 'ㄴ', 'ㅇ', 'ㄹ', 'ㅎ', 'ㅗ', 'ㅓ', 'ㅏ', 'ㅣ'], ['ㅋ', 'ㅌ', 'ㅊ', 'ㅍ', 'ㅠ', 'ㅜ', 'ㅡ', 'ㅐ', 'ㅔ'], ['ㄲ', 'ㄸ', 'ㅃ', 'ㅆ', 'ㅉ', 'ㅒ', 'ㅖ']];

export function dec(w) { let o = ''; for (const ch of w) { const c = ch.charCodeAt(0) - 0xAC00; o += CHO[Math.floor(c / 588)] + JUNG[Math.floor((c % 588) / 28)] + JONG[c % 28]; } return [...o]; }

// 자모 6개가 두 글자 낱말로 맞춰지는지 (맞으면 그 낱말, 아니면 '')
function compose(js) {
  const one = (a) => { // a: 자모 배열 → 한 글자 또는 null
    const ci = CHO.indexOf(a[0]); if (ci < 0) return null;
    for (let v = 1; v <= 2 && v < a.length + 1; v++) {
      const ji = JUNG.indexOf(a.slice(1, 1 + v).join('')); if (ji < 0) continue;
      const ki = JONG.indexOf(a.slice(1 + v).join('')); if (ki < 0) continue;
      return String.fromCharCode(0xAC00 + ci * 588 + ji * 28 + ki);
    }
    return null;
  };
  for (let k = 2; k <= 5; k++) { const a = one(js.slice(0, k)), b = one(js.slice(k)); if (a && b) return a + b; }
  return '';
}

function score(guess, ans) {
  const r = Array(N).fill('miss'), left = {};
  ans.forEach((c, i) => { if (guess[i] === c) r[i] = 'hit'; else left[c] = (left[c] || 0) + 1; });
  guess.forEach((c, i) => { if (r[i] !== 'hit' && left[c]) { r[i] = 'near'; left[c]--; } });
  return r;
}

const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };

export async function mount(el, { toast, esc, dateLabel }) {
  let data; try { data = await (await fetch('data/malmoi.json', { cache: 'no-cache' })).json(); } catch (e) { el.innerHTML = '<p class="note">오늘의 낱말을 불러오지 못했습니다.</p>'; return; }
  const now = new Date(), day = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - START) / 864e5);
  const no = day + 1, [word, meaning] = data.words[((day % data.words.length) + data.words.length) % data.words.length], ans = dec(word);
  const key = 'malmoi:' + no, st = ls.get(key, { rows: [], done: false, win: false, ms: 0 });
  let cur = [];
  const T = P.shell(el, 'malmoi'); el = T.body;

  el.innerHTML = `<div class="mm">
    <p class="mm-head"><span>제${no}회 · 오늘의 낱말</span></p>
    <details class="mm-how"><summary>놀이 방법</summary><p>오늘의 <b>두 글자 낱말</b>을 자음·모음 <b>여섯 칸</b>으로 나눠 맞힙니다. 기회는 여섯 번.<br>예) 단풍 → ㄷ ㅏ ㄴ ㅍ ㅜ ㅇ · 과일 → ㄱ ㅗ ㅏ ㅇ ㅣ ㄹ</p><p class="mm-legend"><span class="t hit">ㄱ</span> 자리까지 맞음 <span class="t near">ㄱ</span> 들어 있지만 자리가 다름 <span class="t miss">ㄱ</span> 없음</p></details>
    <div class="mm-board" id="mm-board"></div>
    <div class="mm-end" id="mm-end" hidden></div>
    <div class="mm-keys" id="mm-keys"></div></div>`;
  const board = el.querySelector('#mm-board'), keysEl = el.querySelector('#mm-keys'), end = el.querySelector('#mm-end');

  function drawBoard() {
    board.innerHTML = Array.from({ length: TRIES }, (_, r) => {
      const row = st.rows[r], live = r === st.rows.length && !st.done;
      const cells = Array.from({ length: N }, (_, i) => {
        if (row) return `<span class="t ${row.s[i]}">${row.g[i]}</span>`;
        if (live) return `<span class="t ${cur[i] ? 'typed' : ''}">${cur[i] || ''}</span>`;
        return '<span class="t"></span>';
      }).join('');
      const word = row ? compose(row.g) : live && cur.length === N ? compose(cur) : '';
      return `<div class="mm-row${live ? ' live' : ''}">${cells}<em>${word}</em></div>`;
    }).join('');
  }
  function drawKeys() {
    const best = {}; const rank = { hit: 3, near: 2, miss: 1 };
    st.rows.forEach(r => r.g.forEach((c, i) => { if (!best[c] || rank[r.s[i]] > rank[best[c]]) best[c] = r.s[i]; }));
    keysEl.innerHTML = KEYS.map((row, ri) => `<div class="mm-krow">${ri === 3 ? '<button type="button" class="k wide" data-k="del">지우기</button>' : ''}${row.map(k => `<button type="button" class="k ${best[k] || ''}" data-k="${k}">${k}</button>`).join('')}${ri === 3 ? '<button type="button" class="k wide go" data-k="ok">확인</button>' : ''}</div>`).join('');
    keysEl.hidden = st.done;
  }
  function stats() {
    const s = ls.get('malmoi:stats', { played: 0, wins: 0, streak: 0, best: 0, last: 0, dist: [0, 0, 0, 0, 0, 0] });
    return s;
  }
  function record() {
    const s = stats(); if (s.last === no) return s;
    s.played++; if (st.win) { s.wins++; s.dist[st.rows.length - 1]++; s.streak = s.last === no - 1 ? s.streak + 1 : 1; s.best = Math.max(s.best, s.streak); } else s.streak = 0;
    s.last = no; ls.set('malmoi:stats', s); return s;
  }
  function drawEnd(fresh) {
    if (!st.done) { end.hidden = true; return; }
    const s = record();
    end.hidden = false;
    end.innerHTML = `<p class="mm-verdict">${st.win ? ['단번에! 놀랍습니다', '두 번 만에, 대단해요', '세 번 만에 맞혔습니다', '네 번 만에 맞혔습니다', '다섯 번 만에, 아슬아슬', '마지막에 맞혔습니다'][st.rows.length - 1] : '아쉽게 놓쳤습니다'}</p>
      <div class="mm-answer"><b>${esc(word)}</b><span>${esc(meaning)}</span></div>
      <div class="mm-stats"><span><b>${s.played}</b>참여</span><span><b>${s.played ? Math.round(s.wins / s.played * 100) : 0}%</b>맞힘</span><span><b>${s.streak}</b>연속</span><span><b>${s.best}</b>최고 연속</span></div>
      <p class="note" style="text-align:center;margin-top:12px">내일 아침, 새 낱말이 기다립니다.</p>`;
    if (st.win && fresh) P.finish('malmoi', st.rows.length * 1e6 + Math.min(st.ms, 999999), `${st.rows.length}번 · ${P.fmtKo(st.ms)}`, end);
    else if (st.win) end.insertAdjacentHTML('beforeend', `<button type="button" class="btn green mm-share" data-rk="1">순위 보기</button>`), end.querySelector('[data-rk]').onclick = () => P.showRank('malmoi');
  }
  function press(k) {
    if (st.done) return;
    if (!T.running()) { T.start(); T.add(st.ms || 0); }
    if (k === 'del') { cur.pop(); drawBoard(); return; }
    if (k === 'ok') {
      if (cur.length < N) { toast('여섯 칸을 모두 채워 주세요.'); return; }
      if (!compose(cur)) { toast('두 글자 낱말이 되지 않습니다. 다시 맞춰 보세요.'); board.querySelector('.mm-row.live')?.classList.add('shake'); setTimeout(() => board.querySelector('.mm-row.live')?.classList.remove('shake'), 500); return; }
      const s = score(cur, ans); st.rows.push({ g: cur, s }); cur = [];
      if (s.every(x => x === 'hit')) { st.done = true; st.win = true; }
      else if (st.rows.length >= TRIES) st.done = true;
      st.ms = st.done ? T.stop() : T.ms();
      ls.set(key, st); drawBoard(); drawKeys(); drawEnd(true);
      if (st.done) { if (st.win) P.sfx('win'); else P.sfx('bad'); setTimeout(() => end.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); } else P.sfx(s.some(x => x === 'hit') ? 'ok' : 'tap');
      return;
    }
    if (cur.length < N) { cur.push(k); P.sfx('tap'); drawBoard(); }
  }
  keysEl.onclick = e => { const b = e.target.closest('[data-k]'); if (b) press(b.dataset.k); };
  drawBoard(); drawKeys(); drawEnd();
}

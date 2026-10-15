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

export async function mount(el, opts, practice = false) {
  const { toast, esc } = opts, root = el;
  let data; try { data = await (await fetch('data/malmoi.json', { cache: 'no-cache' })).json(); } catch (e) { el.innerHTML = '<p class="note">오늘의 낱말을 불러오지 못했습니다.</p>'; return; }
  const now = new Date(), day = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - START) / 864e5);
  const no = day + 1, L = data.words.length, todayIdx = ((day % L) + L) % L;
  let pi = todayIdx; if (practice) { while (pi === todayIdx) pi = Math.floor(Math.random() * L); }
  const [word, meaning] = data.words[pi], ans = dec(word);
  const key = 'malmoi:' + no, st = practice ? { rows: [], done: false, win: false, ms: 0 } : ls.get(key, { rows: [], done: false, win: false, ms: 0 });
  let cur = [];
  const T = P.shell(el, 'malmoi'); el = T.body;

  el.innerHTML = `<div class="mm">
    ${practice ? '<p class="pr-band">연습 판 · 순위에 반영되지 않습니다 <button type="button" class="linkbtn" id="mm-today">오늘 판으로</button></p>' : `<p class="mm-head"><span>제${no}회 · 오늘의 낱말</span></p>${st.rows.length || st.done ? '' : '<button type="button" class="pr-try" id="mm-prac">처음이세요? <b>연습 한 판</b> 먼저 해 보기 <small>순위에 반영되지 않습니다</small></button>'}`}
    <details class="mm-how"${(ls.get('malmoi:stats', {}).played || practice) ? '' : ' open'}><summary>놀이 방법 (처음이면 꼭 읽어 보세요)</summary>
      <ol class="mm-steps"><li>오늘의 정답은 <b>두 글자 낱말</b> 하나예요. 무엇인지는 비밀!</li>
      <li>아무 두 글자 낱말이나 떠올려 <b>자음·모음으로 풀어</b> 여섯 칸에 넣고 <b>확인</b>을 누르세요.<br><small>예) 감귤 → ㄱ ㅏ ㅁ ㄱ ㅠ ㄹ · 과일 → ㄱ ㅗ ㅏ ㅇ ㅣ ㄹ</small></li>
      <li>칸 색깔이 힌트예요. <span class="t hit">ㄱ</span> 초록: 그 자리에 맞음 <span class="t near">ㄱ</span> 노랑: 들어 있지만 자리가 다름 <span class="t miss">ㄱ</span> 회색: 정답에 없음</li>
      <li>힌트를 보고 좁혀 가며 <b>여섯 번 안에</b> 맞히면 성공!</li></ol>
      <p class="mm-exp"><b>이렇게 풀어요</b> (정답이 '단풍'일 때)</p>
      <p class="mm-exrow"><span class="mm-ex"><span class="t miss">ㄱ</span><span class="t hit">ㅏ</span><span class="t miss">ㅁ</span><span class="t miss">ㄱ</span><span class="t miss">ㅠ</span><span class="t miss">ㄹ</span></span><em>감귤 → ㅏ만 맞았네</em></p>
      <p class="mm-exrow"><span class="mm-ex"><span class="t miss">ㅅ</span><span class="t hit">ㅏ</span><span class="t hit">ㄴ</span><span class="t near">ㄷ</span><span class="t miss">ㅡ</span><span class="t miss">ㄹ</span></span><em>산들 → ㄴ도 맞고, ㄷ은 자리가 달라</em></p>
      <p class="mm-exrow"><span class="mm-ex"><span class="t hit">ㄷ</span><span class="t hit">ㅏ</span><span class="t hit">ㄴ</span><span class="t hit">ㅍ</span><span class="t hit">ㅜ</span><span class="t hit">ㅇ</span></span><em>단풍 → 정답!</em></p></details>
    <div class="mm-play"><div class="mm-board" id="mm-board"></div>
    <div class="mm-end" id="mm-end" hidden></div>
    <div class="mm-keys" id="mm-keys"></div></div></div>`;
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
    if (practice) {
      end.hidden = false;
      end.innerHTML = `<p class="mm-verdict">${st.win ? st.rows.length + '번 만에 맞혔어요!' : '아쉽게 놓쳤어요'}</p><div class="mm-answer"><b>${esc(word)}</b><span>${esc(meaning)}</span></div><div class="pl-done-b" style="margin-top:16px"><button type="button" class="btn green" id="mm-more">새 판 더 하기</button><button type="button" class="btn line" id="mm-back">오늘 판으로</button></div><p class="note" style="text-align:center">연습 판은 순위에 반영되지 않습니다.</p>`;
      end.querySelector('#mm-more').onclick = () => mount(root, opts, true); end.querySelector('#mm-back').onclick = () => mount(root, opts, false);
      return;
    }
    const s = record();
    end.hidden = false;
    end.innerHTML = `<p class="mm-verdict">${st.win ? ['단번에! 놀랍습니다', '두 번 만에, 대단해요', '세 번 만에 맞혔습니다', '네 번 만에 맞혔습니다', '다섯 번 만에, 아슬아슬', '마지막에 맞혔습니다'][st.rows.length - 1] : '아쉽게 놓쳤습니다'}</p>
      <div class="mm-answer"><b>${esc(word)}</b><span>${esc(meaning)}</span></div>
      <div class="mm-stats"><span><b>${s.played}</b>참여</span><span><b>${s.played ? Math.round(s.wins / s.played * 100) : 0}%</b>맞힘</span><span><b>${s.streak}</b>연속</span><span><b>${s.best}</b>최고 연속</span></div>
      <p class="note" style="text-align:center;margin-top:12px">내일 아침, 새 낱말이 기다립니다.</p><button type="button" class="btn line pl-again" id="mm-more">새 판 더 하기 <small>· 순위에 반영되지 않습니다</small></button>`;
    end.querySelector('#mm-more').onclick = () => mount(root, opts, true);
    if (st.win && fresh) P.finish('malmoi', st.rows.length * 1e6 + Math.min(st.ms, 999999), `${st.rows.length}번 · ${P.fmtKo(st.ms)}`, end);
    else if (st.win) end.insertAdjacentHTML('beforeend', `<button type="button" class="btn green mm-share" data-rk="1">순위 보기</button>`), end.querySelector('[data-rk]').onclick = () => P.showRank('malmoi');
  }
  function press(k) {
    if (st.done) return;
    if (!T.running()) return;
    if (k === 'del') { cur.pop(); drawBoard(); return; }
    if (k === 'ok') {
      if (cur.length < N) { toast('여섯 칸을 모두 채워 주세요.'); return; }
      if (!compose(cur)) { toast('두 글자 낱말이 되지 않습니다. 다시 맞춰 보세요.'); board.querySelector('.mm-row.live')?.classList.add('shake'); setTimeout(() => board.querySelector('.mm-row.live')?.classList.remove('shake'), 500); return; }
      const s = score(cur, ans); st.rows.push({ g: cur, s }); cur = [];
      if (s.every(x => x === 'hit')) { st.done = true; st.win = true; }
      else if (st.rows.length >= TRIES) st.done = true;
      st.ms = st.done ? T.stop() : T.ms();
      if (!practice) ls.set(key, st); drawBoard(); drawKeys(); drawEnd(true);
      if (st.done) { if (st.win) P.sfx('win'); else P.sfx('bad'); setTimeout(() => end.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); } else P.sfx(s.some(x => x === 'hit') ? 'ok' : 'tap');
      return;
    }
    if (cur.length < N) { cur.push(k); P.sfx('tap'); drawBoard(); }
  }
  keysEl.onclick = e => { const b = e.target.closest('[data-k]'); if (b) press(b.dataset.k); };
  const pb = el.querySelector('#mm-prac'); if (pb) pb.onclick = () => mount(root, opts, true);
  const tb = el.querySelector('#mm-today'); if (tb) tb.onclick = () => mount(root, opts, false);
  drawBoard(); drawKeys(); drawEnd();
  if (!st.done) { const mp = el.querySelector('.mm-play'), wrap = document.createElement('div'); mp.parentElement.insertBefore(wrap, mp); wrap.appendChild(mp); T.countdown(null, st.ms || 0, mp, true); }
}

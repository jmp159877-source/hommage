// 오마주 올리기 전 자동 시험 — `node tests/run.js` (Playwright 필요: NODE_PATH=$(npm root -g))
// 화면 전부(보통·큰 글씨) 오류·넘침, 뒤로 가기 단계, 첫 화면 나가기, 수첩 말로 메모 저장, 인사 카드 6가지.
// 가짜 Firebase(tests/stub)에 가장 최근 daily/*.json 을 넣어 실제 오늘 내용으로 돈다.
const { chromium } = require('playwright'); const fs = require('fs'); const http = require('http'); const path = require('path');
const ROOT = path.join(__dirname, '..'), STUB = path.join(__dirname, 'stub');
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const days = fs.readdirSync(path.join(ROOT, 'daily')).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
const daily = JSON.parse(fs.readFileSync(path.join(ROOT, 'daily', days[days.length - 1]), 'utf8'));
const fsStub = (() => { const s = fs.readFileSync(path.join(STUB, 'firestore.js'), 'utf8'), i = s.indexOf('const key=');
  const today = "(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})()";
  return s.slice(0, i) + `store['daily/'+${today}]=${JSON.stringify(daily)};` + s.slice(i); })();
const results = []; const ok = (name, pass, info = '') => { results.push([pass, name, info]); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };

const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
srv.listen(0, '127.0.0.1', async () => {
  const base = `http://127.0.0.1:${srv.address().port}`; const b = await chromium.launch({ executablePath: exe });
  const ctx = async (big, ua) => { const c = await b.newContext({ viewport: { width: 390, height: 844 }, userAgent: ua });
    await c.route('https://www.gstatic.com/**', r => { const u = r.request().url(); const n = u.includes('firebase-app') ? 'app' : u.includes('firebase-auth') ? 'auth' : u.includes('firestore') ? 'firestore' : 'analytics'; r.fulfill({ contentType: 'application/javascript', body: n === 'firestore' ? fsStub : fs.readFileSync(path.join(STUB, n + '.js'), 'utf8') }); });
    await c.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: "@font-face{font-family:'Nanum Myeongjo';font-weight:800;src:local('Noto Serif CJK KR Bold');}" }));
    await c.route('https://api.open-meteo.com/**', r => r.fulfill({ contentType: 'application/json', body: '{"current":{"temperature_2m":17,"apparent_temperature":16,"relative_humidity_2m":55,"weather_code":2}}' }));
    if (big) await c.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '24px'; }));
    return c; };
  const wait = (p, ms) => p.waitForTimeout(ms);
  try {
    // 1) 화면 전부 × 보통·큰 글씨
    const ROUTES = ['', 'g1', 'g2', 'g3', 'g4', 'culture', 'follow', 'food', 'fortune', 'history', 'music', 'outing', 'phrase', 'play', 'quiz', 'story'];
    for (const big of [false, true]) {
      const c = await ctx(big); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
      await p.goto(base + '/index.html'); await wait(p, 1500); const bad = [];
      for (const h of ROUTES) { await p.evaluate(h => { location.hash = h; }, h); await wait(p, 600);
        const r = await p.evaluate(() => { const o = []; if (document.documentElement.scrollWidth > innerWidth + 1) o.push('가로 넘침');
          for (const im of document.querySelectorAll('img')) if (im.complete && im.naturalWidth === 0 && im.src.startsWith(location.origin) && im.offsetParent) o.push('사진 깨짐 ' + im.src.split('/').pop());
          return o; }); if (r.length) bad.push(`#${h || '첫화면'}: ${r.join(', ')}`); }
      ok(`화면 ${ROUTES.length}개 오류·넘침 (${big ? '큰' : '보통'} 글씨)`, !errs.length && !bad.length, [...new Set(errs)].concat(bad).join(' / '));
      await c.close();
    }
    // 2) 뒤로 가기: 여러 화면을 열고 몇 번 만에 나가는지 (단계: 놀이→장→첫화면→안내→나감)
    { const c = await ctx(false); const p = await c.newPage(); await p.goto(base + '/terms.html'); await p.goto(base + '/index.html'); await wait(p, 1500);
      const go = async h => { await p.evaluate(h => window.omajuNav(h), h); await wait(p, 700); };
      for (const h of ['g1', 'fortune', 'g1', 'food', 'g1', 'quiz', 'culture', 'g2', 'history', 'music', 'g3', 'follow', 'g1', 'play', 'sudoku', 'num50']) await go(h);
      let n = 0, left = false; while (n < 12 && !left) { n++; await p.goBack({ timeout: 3000 }).catch(() => {}); await wait(p, 400); left = p.url().includes('terms'); }
      ok('뒤로 가기 단계 (화면 16번 연 뒤)', left && n <= 6, `${n}번 만에 나감`); await c.close(); }
    // 3) 첫 화면 나가기: 한 번 → 안내, 기다렸다 다시 → 또 안내, 바로 한 번 더 → 나감
    { const c = await ctx(false); const p = await c.newPage(); await p.goto(base + '/terms.html'); await p.goto(base + '/index.html'); await wait(p, 1500);
      const toast = () => p.evaluate(() => { const t = document.getElementById('toast'); return !!(t && !t.hidden && /나갑니다/.test(t.textContent)); }).catch(() => false);
      await p.goBack(); await wait(p, 400); const t1 = await toast(); await wait(p, 3000); await p.goBack(); await wait(p, 400); const t2 = await toast() && p.url().includes('index');
      await p.goBack({ timeout: 3000 }).catch(() => {}); await wait(p, 600); ok('첫 화면 나가기 안내', t1 && t2 && p.url().includes('terms')); await c.close(); }
    // 4) 수첩: 말로 메모 → 다 했어요 → 저장 → 수첩에 그대로 (두 번)
    for (const ua of ['Mozilla/5.0 (Linux; Android 14; SM-F731N) AppleWebKit/537.36 Chrome/129 Mobile Safari/537.36', undefined]) {
      const c = await ctx(false, ua);
      await c.addInitScript(() => { class SR { start() { const me = this; setTimeout(() => { me.onresult && me.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: '다음 주 화요일 치과' }], { isFinal: true })] }); }, 150); } stop() {} abort() {} } window.webkitSpeechRecognition = SR; window.SpeechRecognition = SR; });
      const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); await p.goto(base + '/index.html'); await wait(p, 1500);
      await p.click('#login-btn'); await wait(p, 300); await p.click('#g-signup'); await wait(p, 300);
      await p.fill('#s-id', 'test1960'); await p.click('#s-id-chk'); await wait(p, 200); await p.fill('#s-pw', '123456'); await p.fill('#s-nick', '시험'); await p.click('#s-nick-chk'); await wait(p, 200);
      await p.fill('#s-phone', '01012345678'); await p.click('#s-gender [data-g="여"]'); await p.selectOption('#s-birth', '1962'); await p.check('#s-terms'); await p.check('#s-agree'); await p.click('#s-go'); await wait(p, 800);
      await p.evaluate(() => { const m = document.getElementById('modal-root'); if (m) m.innerHTML = ''; }); await p.evaluate(() => window.omajuNav('g4')); await wait(p, 800);
      let stay = true; for (let k = 0; k < 2; k++) { await p.evaluate(() => document.querySelector('.nb-mic').click()); await wait(p, 900); await p.evaluate(() => document.getElementById('nb-done').click()); await wait(p, 700);
        await p.evaluate(() => { const s = document.getElementById('nb-save'); s && s.click(); }); await wait(p, 1200); stay = stay && (await p.evaluate(() => location.hash)) === '#g4'; }
      ok(`수첩 말로 메모 저장 뒤 머묾 (${ua ? '안드로이드' : 'PC'})`, stay && !errs.length, errs.join(' / '));
      if (!ua) { // 적어 둔 것 고치기 → 지우기 (실제로 눌러서)
        const r = await p.evaluate(async () => { const W = ms => new Promise(r => setTimeout(r, ms)); const out = {};
          const it = document.querySelector('#nb-memo .nb-item'); out.label = !!(it && it.querySelector('.nb-edit')) && !!document.querySelector('#nb-memo .nb-tip');
          it.click(); await W(500); out.editTitle = (document.querySelector('#modal h2') || {}).textContent || '';
          document.getElementById('nb-text').value = '고친 메모 내용'; document.getElementById('nb-save').click(); await W(1000);
          out.edited = [...document.querySelectorAll('#nb-memo .nb-txt')].some(x => x.textContent === '고친 메모 내용'); out.hashAfterEdit = location.hash;
          const before = document.querySelectorAll('#nb-memo .nb-item').length;
          [...document.querySelectorAll('#nb-memo .nb-item')].find(x => x.textContent.includes('고친 메모 내용')).click(); await W(500);
          document.getElementById('nb-del').click(); await W(200); out.ask = !!document.getElementById('nb-del-yes'); document.getElementById('nb-del-yes').click(); await W(1000);
          out.deleted = document.querySelectorAll('#nb-memo .nb-item').length === before - 1 && ![...document.querySelectorAll('#nb-memo .nb-txt')].some(x => x.textContent === '고친 메모 내용'); out.hashAfterDel = location.hash; return out; });
        ok('수첩 고치기·지우기', r.label && /고치기/.test(r.editTitle) && r.edited && r.ask && r.deleted && r.hashAfterEdit === '#g4' && r.hashAfterDel === '#g4', JSON.stringify(r));
      }
      await c.close();
    }
    // 5) 인사 카드: 하루 4장 서로 다른 디자인 + 보내기 그림 6가지
    { const c = await ctx(false); const p = await c.newPage(); await p.goto(base + '/index.html#g1'); await wait(p, 1500);
      const vs = await p.evaluate(() => [...document.querySelectorAll('.gcard.paper')].map(e => e.dataset.v));
      const drawn = await p.evaluate(async () => { const m = await import('./js/cards.js'); const out = []; for (const v of ['v1', 'v2', 'v3', 'v4', 'v5', 'v6']) { const cv = await m.drawCard('시험 문장\n둘째 줄\n셋째 줄', 0, { dateText: '1월 1일 · 월요일', variant: v, season: 'autumn' }); const d = cv.getContext('2d').getImageData(540, 640, 1, 1).data; out.push(cv.width === 1080 && cv.height === 1350 && d[3] === 255); } return out; });
      ok('인사 카드 4장 서로 다른 디자인', vs.length === 4 && new Set(vs).size === 4, vs.join(','));
      ok('보내기 그림 6가지 그려짐', drawn.every(Boolean), drawn.join(',')); await c.close(); }
    // 6) 오늘 PLAY: 몇 판을 하든 순위에 반영 (1 to 50 을 실제로 두 판) + 사천성·스도쿠 새 판도 순위로
    { const c = await ctx(false); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); await p.goto(base + '/index.html'); await wait(p, 1500);
      await p.click('#login-btn'); await wait(p, 300); await p.click('#g-signup'); await wait(p, 300);
      await p.fill('#s-id', 'play1960'); await p.click('#s-id-chk'); await wait(p, 200); await p.fill('#s-pw', '123456'); await p.fill('#s-nick', '놀이시험'); await p.click('#s-nick-chk'); await wait(p, 200);
      await p.fill('#s-phone', '01012345679'); await p.click('#s-gender [data-g="남"]'); await p.selectOption('#s-birth', '1962'); await p.check('#s-terms'); await p.check('#s-agree'); await p.click('#s-go'); await wait(p, 800);
      await p.evaluate(() => { const m = document.getElementById('modal-root'); if (m) m.innerHTML = ''; });
      await p.evaluate(() => window.omajuNav('g1')); await wait(p, 600); await p.evaluate(() => window.omajuNav('play')); await wait(p, 600); await p.evaluate(() => window.omajuNav('num50')); await wait(p, 4500);
      const playOnce = async () => { for (let n = 1; n <= 50; n++) { await p.evaluate(n => { const b = [...document.querySelectorAll('#n5-grid .n5')].find(x => x.textContent.trim() === String(n)); b && b.click(); }, n); } await wait(p, 2500);
        return p.evaluate(() => (document.getElementById('pl-done-s') || {}).textContent || ''); };
      const r1 = await playOnce(); await p.evaluate(() => document.querySelector('.pl-again').click()); await wait(p, 4500); const r2 = await playOnce();
      const okr = t => /상위|1등|중위|하위/.test(t);
      ok('1 to 50 두 판 모두 순위 반영', okr(r1) && okr(r2) && !errs.length, `1판: ${r1.replace(/\s+/g, ' ').slice(0, 40)} / 2판: ${r2.replace(/\s+/g, ' ').slice(0, 40)}`);
      const src = ['shisen', 'sudoku'].map(g => fs.readFileSync(path.join(ROOT, 'js/games', g + '.js'), 'utf8'));
      ok('사천성·스도쿠 새 판도 순위로', src.every(t => !/반영되지 않/.test(t) && /P\.finish\(/.test(t))); await c.close(); }
    // 7) 코너마다 실제로 써 보기 (로그인한 사람처럼)
    { const c = await ctx(false); await c.route('https://www.youtube-nocookie.com/**', r => r.fulfill({ contentType: 'text/html', body: '<html></html>' }));
      await c.addInitScript(() => { window.__spoke = []; Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak: u => { window.__spoke.push(u.text); setTimeout(() => { u.onstart && u.onstart(); setTimeout(() => u.onend && u.onend(), 300); }, 50); }, cancel() {}, getVoices: () => [], speaking: false } }); window.SpeechSynthesisUtterance = function (t) { this.text = t; }; });
      const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); await p.goto(base + '/index.html'); await wait(p, 1500);
      const E = (fn, a) => p.evaluate(fn, a); const W = ms => wait(p, ms);
      const step = async (name, fn) => { try { const r = await fn(); ok('써 보기 · ' + name, r === true, r === true ? '' : String(r)); } catch (e) { ok('써 보기 · ' + name, false, e.message.slice(0, 120)); } };
      const modalText = () => E(() => (document.getElementById('modal') || {}).textContent || '');
      const closeM = async () => { await E(() => { const x = document.getElementById('modal-x'); x && x.click(); }); await W(400); };
      // 가입
      await p.click('#login-btn'); await W(300); await p.click('#g-signup'); await W(300);
      await p.fill('#s-id', 'use1960'); await p.click('#s-id-chk'); await W(200); await p.fill('#s-pw', '123456'); await p.fill('#s-nick', '써보기'); await p.click('#s-nick-chk'); await W(200);
      await p.fill('#s-phone', '01012345671'); await p.click('#s-gender [data-g="남"]'); await p.selectOption('#s-birth', '1961'); await p.check('#s-terms'); await p.check('#s-agree'); await p.click('#s-go'); await W(900);
      await step('회원가입 → 로그인 상태', async () => (await E(() => !document.getElementById('user-chip').hidden || !!document.getElementById('user-nick').textContent)) || 'user-chip 안 보임');
      await closeM();
      await step('준비 중 장 누르면 안내', async () => { await E(() => document.querySelector('[data-soon]').click()); await W(300); return /준비/.test(await E(() => document.getElementById('toast').textContent)) || '안내 없음'; });
      await step('글자 크기 바꾸기', async () => { const a = await E(() => document.documentElement.classList.contains('big')); await E(() => document.getElementById('sizer').click()); const b = await E(() => document.documentElement.classList.contains('big')); await E(() => document.getElementById('sizer').click()); return a !== b || '안 바뀜'; });
      await E(() => window.omajuNav('g1')); await W(700);
      await step('인사 카드 눌러 보내기 창', async () => { await E(() => document.querySelector('[data-copy="0"]').click()); await W(1800); const t = await modalText(); const img = await E(() => { const i = document.querySelector('#modal img'); return !!(i && i.naturalWidth > 0); }); await closeM(); return (/인사 카드가 준비/.test(t) && img) || ('창: ' + t.slice(0, 40)); });
      await step('시세 9가지 표시', async () => { const n = await E(() => document.querySelectorAll('#mk-grid > *').length); return n >= 9 || `${n}개`; });
      await step('운세: 띠 고르기', async () => { await E(() => window.omajuNav('fortune')); await W(600); await E(() => document.querySelector('#zodiac [data-z]').click()); await W(300); const t = await E(() => document.getElementById('fortune').textContent); return (t.length > 30 && !/띠를 고르면/.test(t)) || t.slice(0, 40); });
      await step('시사 상식: 정답 고르고 확인', async () => { await E(() => window.omajuNav('quiz')); await W(600); const ans = await E(() => { const o = document.querySelectorAll('#opts [data-o]'); return o.length; }); if (ans < 4) return '보기 ' + ans; await E(() => document.querySelector('#opts [data-o]').click()); await W(200); await E(() => document.getElementById('quiz-check').click()); await W(400); const r = await E(() => document.getElementById('quiz-result').textContent + document.getElementById('quiz-exp').textContent); return r.trim().length > 5 || '결과 없음'; });
      await step('오늘의 문화: 8칸 모두 열림', async () => { await E(() => window.omajuNav('culture')); await W(800); const tabs = await E(() => [...document.querySelectorAll('[data-cu]')].map(b => b.dataset.cu)); const bad = []; for (const t of tabs) { await E(t => document.querySelector(`[data-cu="${t}"]`).click(), t); await W(300); const len = await E(() => document.getElementById('culture-body').textContent.length); if (len < 60) bad.push(t); } return (tabs.length === 8 && !bad.length) || `칸 ${tabs.length}, 빈 칸 ${bad}`; });
      await step('유머: 반전 보기', async () => { await E(() => document.querySelector('[data-cu="humor"]').click()); await W(300); await E(() => document.getElementById('hu-open').click()); await W(200); return await E(() => !document.getElementById('hu-punch').hidden) || '안 열림'; });
      await step('문화 음악: 장르 바꾸고 재생', async () => { await E(() => document.querySelector('[data-cu="music"]').click()); await W(300); await E(() => document.querySelectorAll('[data-mu]')[1].click()); await W(300); await E(() => document.querySelector('[data-msong]').click()); await W(500); const ok1 = await E(() => !!document.querySelector('#modal iframe, #modal a.btn')); await E(() => { const n = document.getElementById('pl-next'); n && n.click(); }); await W(400); const t = await E(() => (document.querySelector('.pl-no') || {}).textContent || ''); await closeM(); return (ok1 && /^2 \//.test(t.trim())) || `재생 ${ok1}, ${t}`; });
      await step('한마디 남기고 지우기', async () => { await E(() => { const f = document.querySelector('[data-cform="culture"]'); f.querySelector('input').value = '시험 한마디'; f.requestSubmit(); }); await W(900); const has = await E(() => [...document.querySelectorAll('[data-clist="culture"] .cmt')].some(x => x.textContent.includes('시험 한마디'))); if (!has) return '안 남음'; await E(() => document.querySelector('[data-clist="culture"] [data-cdel]').click()); await W(900); return !(await E(() => [...document.querySelectorAll('[data-clist="culture"] .cmt')].some(x => x.textContent.includes('시험 한마디')))) || '안 지워짐'; });
      await step('그해 오늘: 해 바꾸기', async () => { await E(() => window.omajuNav('g2')); await W(500); await E(() => window.omajuNav('history')); await W(700); const y1 = await E(() => document.getElementById('cat-year').textContent); await E(() => document.querySelectorAll('#tabs [data-ago]')[0].click()); await W(300); const y2 = await E(() => document.getElementById('cat-year').textContent); const facts = await E(() => document.querySelectorAll('#era .row, #era .era-fig').length); return (y1 !== y2 && facts >= 2) || `${y1}→${y2}, 소식 ${facts}`; });
      await step('나는 그때: 적기·고치기·지우기', async () => { await E(() => { document.getElementById('memo-in').value = '대학교 3학년'; document.getElementById('memo').requestSubmit(); }); await W(300); const a = await E(() => (document.querySelector('#era .mine') || {}).textContent); await E(() => document.querySelector('[data-mine="edit"]').click()); await W(200); await E(() => { document.getElementById('memo-in').value = '군대 막 다녀온 때'; document.getElementById('memo').requestSubmit(); }); await W(300); const b = await E(() => (document.querySelector('#era .mine') || {}).textContent); await E(() => document.querySelector('[data-mine="del"]').click()); await W(200); await E(() => document.querySelector('[data-mine="del-yes"]').click()); await W(300); const gone = await E(() => !document.querySelector('#era .mine') && !!document.getElementById('memo-in')); return (a === '대학교 3학년' && b === '군대 막 다녀온 때' && gone) || `${a} / ${b} / 지움 ${gone}`; });
      await step('그 시절 노래: 가요·팝송, 재생', async () => { await E(() => window.omajuNav('music')); await W(700); const n1 = await E(() => document.querySelectorAll('[data-song]').length); await E(() => { const b = [...document.querySelectorAll('#genre button')].find(x => /팝/.test(x.textContent)); b && b.click(); }); await W(300); const n2 = await E(() => document.querySelectorAll('[data-song]').length); await E(() => document.querySelector('[data-song]').click()); await W(500); const v = await E(() => !!document.querySelector('#modal iframe')); await closeM(); return (n1 >= 5 && n2 >= 5 && v) || `가요 ${n1}, 팝 ${n2}, 영상 ${v}`; });
      await step('따라하기: 영상 열고 뒤로 닫기', async () => { await E(() => window.omajuNav('g3')); await W(500); await E(() => window.omajuNav('follow')); await W(700); await E(() => document.querySelector('[data-fl]').click()); await W(600); const open = await E(() => !!document.querySelector('#modal iframe')); await p.goBack(); await W(600); const closed = await E(() => !document.getElementById('modal')); const h = await E(() => location.hash); return (open && closed && h === '#follow') || `열림 ${open}, 닫힘 ${closed}, ${h}`; });
      await step('회화: 듣기', async () => { await E(() => window.omajuNav('phrase')); await W(600); await E(() => document.querySelector('[data-say]').click()); await W(500); return (await E(() => window.__spoke.length)) > 0 || '소리 안 남'; });
      await step('나들이: 지역 바꾸기', async () => { await E(() => window.omajuNav('outing')); await W(700); const rs = await E(() => [...document.querySelectorAll('[data-region]')].map(b => b.dataset.region)); if (rs.length < 2) return `지역 ${rs.length}개`; await E(r => document.querySelector(`[data-region="${r}"]`).click(), rs[1]); await W(300); const t = await E(() => document.getElementById('outing-title').textContent); const items = await E(() => document.querySelectorAll('#outing-body .ot-row').length); return (t.includes(rs[1]) && items > 0) || `${t}, ${items}`; });
      await step('놀이 4종 열림', async () => { const bad = []; for (const g of ['malmoi', 'shisen', 'num50', 'sudoku']) { await E(() => window.omajuNav('g1')); await W(300); await E(() => window.omajuNav('play')); await W(400); await E(g => window.omajuNav(g), g); await W(1500); const n = await E(g => (document.getElementById({ malmoi: 'mm-root', shisen: 'ss-root', num50: 'n5-root', sudoku: 'sd-root' }[g]) || {}).innerHTML.length || 0, g); if (n < 200) bad.push(g); } return !bad.length || '안 열림 ' + bad; });
      await step('놀이 순위 보기 창', async () => { await E(() => document.querySelector('[data-rank]').click()); await W(800); const t = await modalText(); await closeM(); return /순위/.test(t) || t.slice(0, 40); });
      await step('수첩: 달력 펼치고 날짜 고르기', async () => { await E(() => window.omajuNav('g4')); await W(700); await E(() => document.getElementById('nb-calbtn').click()); await W(400); const open = await E(() => document.getElementById('nb-calbtn').getAttribute('aria-expanded')); await E(() => { const d = document.querySelectorAll('[data-cal]'); d[Math.min(10, d.length - 1)].click(); }); await W(300); const day = await E(() => !!document.querySelector('.cal-day')); return (open === 'true' && day) || `펼침 ${open}, 날짜 ${day}`; });
      await step('수첩: 손으로 일정 적기', async () => { await E(() => document.querySelector('.nb-hand[data-kind="event"]').click()); await W(400); await E(() => { document.getElementById('nb-text').value = '치과 예약'; document.getElementById('nb-save').click(); }); await W(900); return (await E(() => [...document.querySelectorAll('#nb-event .nb-txt')].some(x => x.textContent === '치과 예약'))) || '안 보임'; });
      await step('아침 알림 시간 고르기 창', async () => { await E(() => window.omajuNav('g1')); await W(500); const has = await E(() => { const b = document.getElementById('push-cta'); if (!b || b.hidden) return 'none'; b.click(); return 'ok'; }); if (has === 'none') return true; await W(600); const n = await E(() => document.querySelectorAll('[data-hour]').length); await closeM(); return n === 3 || `시간 단추 ${n}`; });
      await step('내 정보 창', async () => { await E(() => document.getElementById('my').click()); await W(500); const t = await modalText(); await closeM(); return /별명|비밀번호|글자/.test(t) || t.slice(0, 40); });
      await step('로그아웃 → 다시 로그인', async () => { await E(() => document.getElementById('logout').click()); await W(800); await closeM(); const out = await E(() => !document.getElementById('login-btn').hidden); await E(() => document.getElementById('login-btn').click()); await W(400); await E(() => { const b = document.getElementById('g-login'); b && b.click(); }); await W(400); await p.fill('#l-id', 'use1960'); await p.fill('#l-pw', '123456'); await E(() => document.getElementById('l-go').click()); await W(1000); const back = await E(() => !!document.getElementById('user-nick').textContent); return (out && back) || `로그아웃 ${out}, 로그인 ${back}`; });
      await step('아이디·비밀번호 찾기 창', async () => { await E(() => document.getElementById('logout').click()); await W(800); await closeM(); await E(() => document.getElementById('login-btn').click()); await W(400); await E(() => { const b = document.getElementById('g-login'); b && b.click(); }); await W(400); await E(() => document.getElementById('l-forgot').click()); await W(500); const t = await modalText(); await closeM(); return /찾기|연락처|아이디/.test(t) || t.slice(0, 40); });
      ok('써 보기 중 화면 오류 없음', !errs.length, [...new Set(errs)].join(' / '));
      await c.close(); }
  } catch (e) { ok('시험 실행', false, e.message); }
  await b.close(); srv.close();
  const fails = results.filter(r => !r[0]).length; console.log(fails ? `\n실패 ${fails}개 — 올리지 말고 고칠 것` : '\n모두 통과'); process.exit(fails ? 1 : 0);
});

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
      ok(`수첩 말로 메모 저장 뒤 머묾 (${ua ? '안드로이드' : 'PC'})`, stay && !errs.length, errs.join(' / ')); await c.close();
    }
    // 5) 인사 카드: 하루 4장 서로 다른 디자인 + 보내기 그림 6가지
    { const c = await ctx(false); const p = await c.newPage(); await p.goto(base + '/index.html#g1'); await wait(p, 1500);
      const vs = await p.evaluate(() => [...document.querySelectorAll('.gcard.paper')].map(e => e.dataset.v));
      const drawn = await p.evaluate(async () => { const m = await import('./js/cards.js'); const out = []; for (const v of ['v1', 'v2', 'v3', 'v4', 'v5', 'v6']) { const cv = await m.drawCard('시험 문장\n둘째 줄\n셋째 줄', 0, { dateText: '1월 1일 · 월요일', variant: v, season: 'autumn' }); const d = cv.getContext('2d').getImageData(540, 640, 1, 1).data; out.push(cv.width === 1080 && cv.height === 1350 && d[3] === 255); } return out; });
      ok('인사 카드 4장 서로 다른 디자인', vs.length === 4 && new Set(vs).size === 4, vs.join(','));
      ok('보내기 그림 6가지 그려짐', drawn.every(Boolean), drawn.join(',')); await c.close(); }
  } catch (e) { ok('시험 실행', false, e.message); }
  await b.close(); srv.close();
  const fails = results.filter(r => !r[0]).length; console.log(fails ? `\n실패 ${fails}개 — 올리지 말고 고칠 것` : '\n모두 통과'); process.exit(fails ? 1 : 0);
});

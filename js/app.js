import { DEFAULT_CONTENT } from './content.js';
import * as DB from './db.js';
import * as NB from './notebook.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = { get(k, d) { try { const v = localStorage.getItem('omaju.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('omaju.' + k, JSON.stringify(v)); } catch (e) {} } };
let toastT, readingBtn = null; function toast(m) { const t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2800); }
const SITE = location.origin + '/';
const TAGLINE = '— 오마주, 매일 아침 5분, 마음은 주니어\n' + location.origin + '/';

// ── 날짜 ──
const now = new Date(), M = now.getMonth(), D = now.getDate(), Y = now.getFullYear(), WD = ['일', '월', '화', '수', '목', '금', '토'];
const TODAY = DB.todayKey(now);
$('toc-date').textContent = `${M + 1}월 ${D}일 ${['일','월','화','수','목','금','토'][new Date().getDay()]}요일`; $('date').textContent = `${Y}년 ${M + 1}월 ${D}일 ${WD[now.getDay()]}요일`;
try { const p = new Intl.DateTimeFormat('ko-KR-u-ca-dangi', { month: 'numeric', day: 'numeric' }).formatToParts(now); const m = p.find(x => x.type === 'month'), d = p.find(x => x.type === 'day'); if (m && d) $('lunar').textContent = `음력 ${m.value}월 ${d.value}일`; } catch (e) {}
const SEASON = M < 2 || M === 11 ? 'winter' : M < 5 ? 'spring' : M < 8 ? 'summer' : 'autumn';
$('wx-card').style.backgroundImage = `url('img/${SEASON}.jpg')`;

// ── 글자 크기 ──
function applySize(b) { document.documentElement.classList.toggle('big', b); $('sizer').textContent = b ? '글자 보통' : '글자 크게'; }
applySize(store.get('big', true)); $('sizer').onclick = () => { const b = !document.documentElement.classList.contains('big'); applySize(b); store.set('big', b); };

// ── 콘텐츠 ──
let C = DEFAULT_CONTENT;
const remote = await DB.loadDaily(TODAY);
if (remote) C = Object.assign({}, DEFAULT_CONTENT, remote);
DB.bumpVisit();
DB.loadMaint().then(m => { if (m && m.on && !DB.isAdmin()) { $('maint-text').textContent = m.text || ''; $('maint').hidden = false; } });
DB.loadNotice().then(n => { if (n && n.text) { $('notice-text').textContent = n.text; $('notice').hidden = false; } });

// ── 날씨 ──
const WMO = { 0: '맑음', 1: '대체로 맑음', 2: '구름 조금', 3: '흐림', 45: '안개', 48: '안개', 51: '이슬비', 53: '이슬비', 55: '이슬비', 56: '이슬비', 57: '이슬비', 61: '약한 비', 63: '비', 65: '강한 비', 66: '진눈깨비', 67: '진눈깨비', 71: '약한 눈', 73: '눈', 75: '많은 눈', 77: '싸락눈', 80: '소나기', 81: '소나기', 82: '강한 소나기', 85: '눈', 86: '많은 눈', 95: '천둥번개', 96: '천둥번개', 99: '천둥번개' };
function wxSay(t, c) { if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95) return '비 소식이 있습니다. 우산 챙기시고, 빗소리 좋은 창가에서 차 한 잔 어떠세요.'; if ((c >= 71 && c <= 77) || c === 85 || c === 86) return '눈이 옵니다. 길이 미끄러우니 천천히, 풍경은 넉넉히 즐기세요.'; if (t >= 28) return '더운 날입니다. 물 자주 드시고 한낮 볕은 잠시 피하세요.'; if (t >= 18) return '걷기 딱 좋은 날씨입니다. 가까운 길이라도 한 바퀴 돌고 오세요.'; if (t >= 8) return '아침저녁으로 쌀쌀합니다. 겉옷 하나 걸치고 나서세요.'; return '날이 찹니다. 목도리 두르고, 따뜻한 국물로 속부터 데우세요.'; }

// 날씨 그림: 맑음 해, 구름, 비, 눈, 천둥, 안개
function wxIcon(c) {
  const sun = '<circle cx="12" cy="12" r="4.2" fill="#FFD54A"/><g stroke="#FFD54A" stroke-width="1.8" stroke-linecap="round"><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></g>';
  const cloud = (fill, dy = 0) => `<path transform="translate(0 ${dy})" d="M7 18.5h10.5a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6-1.4A3.8 3.8 0 0 0 7 18.5z" fill="${fill}"/>`;
  const sunCloud = '<circle cx="8" cy="9" r="3.4" fill="#FFD54A"/><g stroke="#FFD54A" stroke-width="1.6" stroke-linecap="round"><path d="M8 2.6v1.8M2.6 9h1.8M4.2 5.2l1.3 1.3M11.8 5.2l-1.3 1.3"/></g>' + cloud('#F4F1EA', 1);
  const rain = cloud('#DCE3E8', -3) + '<g stroke="#6FB7F0" stroke-width="1.8" stroke-linecap="round"><path d="M8.5 17.5l-1 3M12 17.5l-1 3M15.5 17.5l-1 3"/></g>';
  const snow = cloud('#DCE3E8', -3) + '<g fill="#fff"><circle cx="8" cy="19" r="1.2"/><circle cx="12" cy="20.5" r="1.2"/><circle cx="16" cy="19" r="1.2"/></g>';
  const storm = cloud('#B9C3CC', -3) + '<path d="M12.5 15.5l-2.5 4h2.2l-1.2 3.5 3.5-5h-2.2l1.2-2.5z" fill="#FFD54A"/>';
  const fog = '<g stroke="#E6E6E6" stroke-width="1.8" stroke-linecap="round"><path d="M4 9h16M6 13h12M4 17h16"/></g>';
  let g = sunCloud;
  if (c === 0 || c === 1) g = sun; else if (c === 2) g = sunCloud; else if (c === 3) g = cloud('#E6E6E6', 0); else if (c === 45 || c === 48) g = fog;
  else if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) g = rain; else if ((c >= 71 && c <= 77) || c === 85 || c === 86) g = snow; else if (c >= 95) g = storm;
  return `<svg class="wx-ic" viewBox="0 0 24 24" width="34" height="34" aria-hidden="true">${g}</svg>`;
}
async function loadWx(lat, lon, label) {
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code&timezone=auto`);
    const d = await r.json(); const c = d.current; if (!c) throw 0;
    const t = Math.round(c.temperature_2m), desc = WMO[c.weather_code] || '';
    $('wx-temp').textContent = t + '°'; $('wx-desc').textContent = desc;
    $('wx-sub').textContent = `${label} · 체감 ${Math.round(c.apparent_temperature)}° · 습도 ${Math.round(c.relative_humidity_2m)}%`;
    $('wx-say').textContent = wxSay(t, c.weather_code);
    $('wx-pill').innerHTML = wxIcon(c.weather_code) + `<span>${esc(label)}  ·  ${esc(desc)}  ${t}°</span>`;
  } catch (e) { $('wx-temp').textContent = ''; $('wx-desc').textContent = '지금은 날씨를 불러오지 못했습니다.'; $('wx-say').textContent = '오늘도 좋은 하루 보내세요.'; }
}
function askHere(silent) {
  if (!navigator.geolocation) { if (!silent) toast('이 기기에서는 위치를 알 수 없습니다.'); return; }
  navigator.geolocation.getCurrentPosition(p => { store.set('geo', [p.coords.latitude, p.coords.longitude]); loadWx(p.coords.latitude, p.coords.longitude, '내 동네'); }, err => { if (silent) return; if (err.code === 1) modal(`<h2>위치 허용이 필요합니다</h2><p>휴대폰이 위치를 알려 주지 않도록 되어 있습니다.</p><div class="steps-ios">1. 크롬 주소창 왼쪽의 <b>자물쇠(또는 ⓘ)</b>를 누르세요.<br>2. <b>권한</b> → <b>위치</b>를 "허용"으로 바꾸세요.<br>3. 이 화면으로 돌아와 다시 눌러 주세요.</div><p class="note">허용하지 않아도 가입할 때 적은 거주 지역의 날씨를 보여 드립니다.</p>`); else toast('지금은 위치를 알 수 없습니다. 잠시 뒤 다시 눌러 주세요.'); }, { timeout: 8000 });
}
// 시·도별 대표 좌표 (가입 때 적은 거주 지역으로 날씨 보기)
const REGION_XY = { '서울': [37.5665, 126.978], '경기': [37.4138, 127.5183], '인천': [37.4563, 126.7052], '부산': [35.1796, 129.0756], '대구': [35.8714, 128.6014], '광주': [35.1595, 126.8526], '대전': [36.3504, 127.3845], '울산': [35.5384, 129.3114], '세종': [36.48, 127.289], '강원': [37.8813, 127.7298], '충북': [36.6424, 127.489], '충남': [36.6588, 126.6728], '전북': [35.8242, 127.148], '전남': [34.8161, 126.4629], '경북': [36.576, 128.5056], '경남': [35.2383, 128.6924], '제주': [33.4996, 126.5312] };
const geo = store.get('geo', null);
if (geo) loadWx(geo[0], geo[1], '내 동네'); else { loadWx(37.5665, 126.978, '서울'); askHere(true); }
function wxByRegion(p) { if (store.get('geo', null) || !p || !p.region) return; const sido = p.region.split(' ')[0], xy = REGION_XY[sido]; if (xy) loadWx(xy[0], xy[1], p.region); }
$('wx-here').onclick = () => askHere(false);

// ── 인사말 (그림 카드) ──
const CARD_BG = ['spring', 'summer', 'autumn', 'winter'];
const cardsEl = $('cards');
cardsEl.innerHTML = C.greetings.map((c, i) => `<button type="button" class="gcard photo" data-copy="${i}" style="background-image:url('img/${CARD_BG[i % 4]}.jpg')"><q>${esc(c).replace(/\n/g, '<br>')}</q><span class="send">누르면 카톡으로 보내기</span><img src="leaf.png" alt=""></button>`).join('');
async function makeCard(i) {
  const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  const img = new Image(); img.src = `img/${CARD_BG[i % 4]}.jpg`; await new Promise(r => { img.onload = r; img.onerror = r; });
  if (img.width) { const s = Math.max(W / img.width, H / img.height); x.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s); } else { x.fillStyle = '#0F4A35'; x.fillRect(0, 0, W, H); }
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(10,45,32,0.15)'); g.addColorStop(1, 'rgba(10,45,32,0.85)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = '#F4F1EA'; x.textAlign = 'center'; x.shadowColor = 'rgba(0,0,0,0.5)'; x.shadowBlur = 12;
  try { await document.fonts.load('700 80px Gaegu'); } catch (e) {}
  x.font = '700 84px Gaegu, "Noto Sans KR", sans-serif'; const lines = C.greetings[i].split('\n'); lines.forEach((l, k) => x.fillText(l, W / 2, H * 0.62 + k * 96));
  x.font = '400 38px "Noto Sans KR", sans-serif'; x.fillText(`${Y}년 ${M + 1}월 ${D}일`, W / 2, H - 210);
  x.font = 'bold 44px "Noto Sans KR", sans-serif'; x.fillText('오마주 · 매일 아침 5분, 마음은 주니어', W / 2, H - 130);
  x.font = '400 34px "Noto Sans KR", sans-serif'; x.fillText('omaju.kr', W / 2, H - 70);
  return new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9));
}
cardsEl.onclick = async e => {
  const b = e.target.closest('[data-copy]'); if (!b) return; const i = +b.dataset.copy; DB.bumpClick('greeting');
  toast('카드를 만드는 중입니다…');
  const blob = await makeCard(i), file = new File([blob], 'omaju-card.jpg', { type: 'image/jpeg' });
  const text = C.greetings[i].replace(/\n/g, ' ') + '\n' + TAGLINE;
  const url = URL.createObjectURL(blob), canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  modal(`<h2>인사 카드가 준비되었습니다</h2><img src="${url}" alt="" style="width:100%;max-width:260px;display:block;margin:0 auto 16px;box-shadow:0 6px 20px rgba(0,0,0,0.25)"><div class="modal-actions">${canShare ? '<button type="button" class="btn green" id="card-share">카톡으로 보내기</button>' : ''}<button type="button" class="btn line" id="card-save">사진에 저장하기</button></div>`);
  const save = () => { const a = document.createElement('a'); a.href = url; a.download = 'omaju-card.jpg'; a.click(); closeModal(); modal(`<h2>카드를 저장했습니다</h2><p style="font-size:1.1rem">휴대폰 <b>사진(갤러리)</b>에 저장되었습니다. 카톡에서 사진 보내기로 보내 주세요.</p>`); };
  $('card-save').onclick = save;
  if (canShare) $('card-share').onclick = async () => { try { await navigator.share({ files: [file], text }); closeModal(); } catch (err) { if (err.name !== 'AbortError') save(); } };
};


// 휴대폰 첫 화면 높이를 열 때 한 번만 숫자로 고정 (주소창 숨김으로 흔들리지 않게)
(function fixHero() {
  const hero = document.querySelector('.hero'); if (!hero) return; let w = 0;
  const set = () => { if (window.innerWidth > 768) { hero.style.minHeight = ''; w = 0; return; } if (window.innerWidth === w) return; w = window.innerWidth; const h = Math.max(window.innerHeight, screen.height * 0.9); hero.style.minHeight = Math.round(h * 1.28) + 'px'; const box = hero.querySelector(':scope > div:last-child'); if (box) box.style.paddingTop = Math.round(h * 0.07 + 18) + 'px'; };
  set(); window.addEventListener('resize', set); window.addEventListener('orientationchange', () => setTimeout(set, 300));
})();


// 따라오는 한 줄 메뉴: 큰 네 칸이 화면 위로 지나가면 별도의 띠가 나타난다 (화면 길이 안 바뀜)
(function miniTabs() {
  const t = $('tabs3'); if (!t) return;
  const mini = document.createElement('nav'); mini.className = 'tabs-mini'; mini.id = 'tabs-mini';
  mini.innerHTML = [...t.querySelectorAll('[data-tab]')].map(b => `<button type="button" data-tab="${b.dataset.tab}" aria-pressed="${b.getAttribute('aria-pressed')}"><span>${b.querySelector('b').textContent}</span></button>`).join('');
  document.body.appendChild(mini);
  mini.onclick = e => { const b = e.target.closest('[data-tab]'); if (!b) return; t.querySelector(`[data-tab="${b.dataset.tab}"]`).click(); };
  const sync = () => mini.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-pressed', t.querySelector(`[data-tab="${x.dataset.tab}"]`).getAttribute('aria-pressed')));
  new MutationObserver(sync).observe(t, { attributes: true, subtree: true, attributeFilter: ['aria-pressed'] });
  const onScroll = () => { const r = t.getBoundingClientRect(); mini.classList.toggle('show', r.bottom < 0 && !document.body.classList.contains('in-detail')); };
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
})();



// ── 앞으로 나아가기: 따라하기 · 회화 · 나들이 ──
const FOLLOW_ORDER = ['gym', 'sing', 'dance', 'golf', 'park'];
function renderFollow() {
  const f = C.follow; if (!f) { $('follow-body').innerHTML = '<p class="note" style="margin-top:30px">오늘 영상이 준비되지 않았습니다. 내일 다시 들러 주세요.</p>'; return; }
  $('follow-body').innerHTML = '<div class="fl-list">' + FOLLOW_ORDER.filter(k => f[k]).map(k => { const it = f[k]; const yt = it.videoId ? `https://www.youtube.com/watch?v=${it.videoId}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(it.query)}`;
    return `<div class="fl-item"><div class="fl-head"><b>${esc(it.name)}</b><span>${esc(it.say || '')}</span></div>${it.videoId ? `<div class="fl-video"><iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/${esc(it.videoId)}?rel=0" title="${esc(it.title || it.name)}" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div><p class="fl-cap">${esc(it.title || '')}${it.channel ? ' · ' + esc(it.channel) : ''}</p>` : ''}<a class="btn line fl-go" href="${yt}" target="_blank" rel="noopener" data-track="follow_${k}">${it.videoId ? '크게 보기 (유튜브)' : '유튜브에서 "' + esc(it.query) + '" 보기'}</a></div>`; }).join('') + '</div>';
}
const LANG = { en: ['영어', 'en-US'], ja: ['일본어', 'ja-JP'], zh: ['중국어', 'zh-CN'] };
function renderPhrase() {
  const p = C.phrase; if (!p) { $('phrase-body').innerHTML = '<p class="note" style="margin-top:30px">오늘 문장이 준비되지 않았습니다.</p>'; return; }
  $('phrase-body').innerHTML = `<p class="lead" style="margin-top:26px">오늘의 상황: <b>${esc(p.topic || '')}</b>. 듣고, 소리 내어 따라 말해 보세요.</p>` + Object.keys(LANG).filter(k => p[k]).map(k => { const x = p[k]; return `<div class="ph-card"><div class="ph-lang">${LANG[k][0]}</div><p class="ph-text">${esc(x.text)}</p><p class="ph-read">${esc(x.reading || '')}</p><p class="ph-mean">${esc(x.meaning || '')}</p>${x.tip ? `<p class="ph-tip">${esc(x.tip)}</p>` : ''}<div class="ph-actions"><button type="button" class="btn green" data-say="${k}" data-rate="0.9">듣기</button><button type="button" class="btn line" data-say="${k}" data-rate="0.6">천천히 듣기</button></div></div>`; }).join('');
  if (C.phrase.topic) $('phrase-title').textContent = '오늘의 상황: ' + C.phrase.topic;
}
document.addEventListener('click', e => { const b = e.target.closest('[data-say]'); if (!b) return; const k = b.dataset.say, x = C.phrase[k]; if (!('speechSynthesis' in window)) return toast('이 기기에서는 듣기를 쓸 수 없습니다.'); speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(x.text); u.lang = LANG[k][1]; u.rate = +b.dataset.rate; const v = speechSynthesis.getVoices().filter(v => v.lang && v.lang.replace('_', '-').toLowerCase().startsWith(LANG[k][1].slice(0, 2).toLowerCase())).sort((a, b) => (/google|natural|neural|premium/i.test(b.name) ? 1 : 0) - (/google|natural|neural|premium/i.test(a.name) ? 1 : 0))[0]; if (v) u.voice = v; speechSynthesis.speak(u); DB.track('phrase_listen', { lang: k }); });
let outRegion = store.get('outRegion', '서울');
function renderOuting() {
  const o = C.outing; if (!o || !Object.keys(o).length) { $('outing-tabs').innerHTML = ''; $('outing-body').innerHTML = '<p class="note" style="margin-top:30px">이번 주 소식이 준비되지 않았습니다.</p>'; return; }
  const regions = Object.keys(REGION_XY).filter(r => o[r]); if (!o[outRegion]) outRegion = regions[0];
  $('outing-tabs').innerHTML = regions.map(r => `<button type="button" data-region="${r}" aria-pressed="${r === outRegion}">${r}</button>`).join('');
  $('outing-body').innerHTML = '<div class="rows" style="margin-top:20px">' + o[outRegion].map(it => `<div class="row ot-row"><span class="ot-kind">${esc(it.kind || '나들이')}</span><b>${esc(it.title)}</b><p class="ot-meta">${esc(it.where || '')}${it.when ? ' · ' + esc(it.when) : ''}</p><p>${esc(it.why || '')}</p><a class="linkbtn" href="https://map.naver.com/p/search/${encodeURIComponent(it.where || it.title)}" target="_blank" rel="noopener">지도에서 보기</a></div>`).join('') + '</div><p class="note">내용은 매일 아침 새로 찾아 넣습니다. 가기 전에 날짜와 시간을 한 번 더 확인해 주세요.</p>';
  $('outing-title').textContent = `${outRegion} · 이번 주말 가볼 만한 곳`;
}
$('outing-tabs').onclick = e => { const b = e.target.closest('[data-region]'); if (!b) return; outRegion = b.dataset.region; store.set('outRegion', outRegion); renderOuting(); };
renderFollow(); renderPhrase(); renderOuting();
// 나들이 배너·상세 사진은 계절에 따라 (봄·여름·겨울 전용 사진이 오면 outing-spring.jpg 등으로 교체)
(function seasonOuting() { const m = new Date().getMonth() + 1; const pic = m >= 9 && m <= 11 ? 'outing' : m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : 'winter'; const b = document.querySelector('[data-open="outing"]'); if (b) b.style.backgroundImage = `url('img/${pic}.jpg')`; })();



// ── 노래 재생기: 오마주 안에서 유튜브 영상 재생 (검색 화면·추천 광고로 나가지 않음) ──
let SONGV = null;
fetch('data/song_videos.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : {}).then(j => { SONGV = j; }).catch(() => { SONGV = {}; });
function playSong(i) {
  const list = C.era[ago].songs, s = list[i]; if (!s) return;
  const v = SONGV && SONGV[`${s[0]}|${s[1]}`];
  const nav = `<div class="pl-nav"><button type="button" class="btn line" id="pl-prev" ${i === 0 ? 'disabled' : ''}>이전 곡</button><button type="button" class="btn green" id="pl-next" ${i === list.length - 1 ? 'disabled' : ''}>다음 곡</button></div>`;
  const body = v && v.v
    ? `<div class="pl-video"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.v)}?autoplay=1&rel=0&modestbranding=1&playsinline=1" title="${esc(s[0])}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`
    : `<p class="note" style="margin:16px 0">이 노래는 아직 영상을 준비하지 못했습니다.</p><a class="btn line" style="display:block;text-align:center;text-decoration:none" href="https://www.youtube.com/results?search_query=${encodeURIComponent(s[1] + ' ' + s[0])}" target="_blank" rel="noopener">유튜브에서 찾아보기</a>`;
  modal(`<div class="pl-head"><span class="pl-no">${i + 1} / ${list.length}</span><h2>${esc(s[0])}</h2><p>${esc(s[1])} · ${Y - ago}년</p></div>${body}${nav}`, () => {
    $('modal').classList.add('pl-modal');
    $('pl-prev').onclick = () => playSong(i - 1); $('pl-next').onclick = () => playSong(i + 1);
  });
  DB.track('song_play', { year: Y - ago });
}
document.addEventListener('click', e => { const b = e.target.closest('[data-song]'); if (b) playSong(+b.dataset.song); });

NB.init({ toast, modal, closeModal, openGate });

// ── 오늘의 시세 ──
(async function market() {
  const m = await DB.loadMarket(); if (!m || !m.items || !m.items.length) return;
  const fmt = (v, u) => { if (u === '') return v.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); const n = Math.round(v); if (n >= 100000000) { const eok = Math.floor(n / 100000000), man = Math.round((n % 100000000) / 10000); return `${eok}억${man ? ' ' + man.toLocaleString('ko-KR') + '만' : ''}${u}`; } if (n >= 10000000) return Math.round(n / 10000).toLocaleString('ko-KR') + '만' + u; return n.toLocaleString('ko-KR') + u; };
  const ORDER = ['코스피', '코스닥', '미국 달러', '일본 엔 (100엔)', '유로', '금 1돈', '은 1돈', '비트코인', '이더리움']; const items = [...m.items].sort((a, b) => (ORDER.indexOf(a.label) + 99) % 99 - (ORDER.indexOf(b.label) + 99) % 99);
  $('mk-grid').innerHTML = items.map(i => `<div class="mk-item"><span class="mk-l">${esc(i.label)}</span><b class="mk-v">${fmt(i.value, i.unit)}</b>${i.change == null ? '' : `<span class="mk-c ${i.change > 0 ? 'up' : i.change < 0 ? 'down' : ''}">${i.change > 0 ? '▲' : i.change < 0 ? '▼' : '－'} ${Math.abs(i.change).toFixed(2)}%</span>`}</div>`).join('');
  const t = new Date(m.updatedAt); $('mk-foot').textContent = `${t.getMonth() + 1}월 ${t.getDate()}일 ${t.getHours()}시 기준 · 금·은은 국제 시세 환산(1돈)`;
  $('mk-sec').hidden = false;
})();

// ── 운세 ──
const ZO = Object.keys(C.fortune);
let myZ = store.get('zodiac', null);
function renderZ() { $('zodiac').innerHTML = ZO.map(z => `<button type="button" data-z="${z}" aria-pressed="${myZ === z}">${z}</button>`).join(''); $('fortune').textContent = myZ ? C.fortune[myZ] : '띠를 고르면 오늘의 한마디가 나옵니다.'; }
$('zodiac').onclick = e => { const b = e.target.closest('[data-z]'); if (!b) return; myZ = b.dataset.z; store.set('zodiac', myZ); if (DB.currentUser()) DB.saveProfile({ zodiac: myZ }).catch(() => {}); renderZ(); };
renderZ();

// ── 배너 펼치기 / 안쪽 화면 ──
document.addEventListener('click', e => {
  const t = e.target.closest('[data-toggle]'); if (t) { t.classList.toggle('open'); if (t.classList.contains('open') && t.dataset.corner) DB.bumpClick(t.dataset.corner); }
  const o = e.target.closest('[data-open]'); if (o) { route.y = window.scrollY; DB.bumpClick(o.dataset.corner); location.hash = o.dataset.open; }
});

// ── 그해 오늘 · 노래 ──
let ago = store.get('ago', 40);
function renderEra() {
  const tabs = [50, 40, 30, 20].map(n => `<button type="button" data-ago="${n}" aria-pressed="${ago === n}">${n}년 전</button>`).join('');
  $('tabs').innerHTML = tabs; $('tabs2').innerHTML = tabs;
  const yr = Y - ago, e = C.era[ago], memo = store.get('memo' + ago, ''); $('cat-year').textContent = yr;
  let h = `<p class="lead" style="margin-top:30px">${esc(e.mood)}</p><div class="rows">` + e.facts.map(f => `<div class="row"><b>${esc(f[0])}</b><p>${esc(f[1])}</p></div>`).join('') + '</div>';
  h += '<h3 class="subhead">나는 그때</h3>' + (memo ? `<p class="mine">${esc(memo)}</p>` : `<form class="memo" id="memo"><input type="text" id="memo-in" maxlength="60" placeholder="${yr}년의 나는 어디서 무엇을 하고 있었나요"><button type="submit" class="btn green">남기기</button></form>`);
  $('era').innerHTML = h;
  $('songs').innerHTML = `<p class="note" style="margin:30px 0 0">노래를 누르면 이 화면에서 바로 들려 드립니다.</p><div class="rows">` + e.songs.map((s, i) => `<button type="button" class="row song-row" data-song="${i}"><span class="song-no">${i + 1}</span><p><strong>${esc(s[0])}</strong><span>${esc(s[1])}</span></p><span class="song-play" aria-hidden="true">▶</span></button>`).join('') + '</div>';
  if (cur) setTitle();
}
const onTab = e => { const b = e.target.closest('[data-ago]'); if (!b) return; ago = +b.dataset.ago; store.set('ago', ago); renderEra(); };
$('tabs').onclick = onTab; $('tabs2').onclick = onTab;
document.addEventListener('submit', e => { if (e.target.id !== 'memo') return; e.preventDefault(); const v = $('memo-in').value.trim(); if (!v) return; store.set('memo' + ago, v); renderEra(); });

// ── 한 끼 · 사연 ──
$('meal-title').textContent = C.meal.title; $('meal-sub').textContent = C.meal.sub;
$('meal').innerHTML = `<p class="lead">${esc(C.meal.lead)}</p><ul class="ing">${C.meal.ingredients.map(i => `<li>${esc(i)}</li>`).join('')}</ul><ol class="steps">${C.meal.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol><p class="note">${esc(C.meal.tip || '')}</p>`;
$('story-title').textContent = C.story.title; $('story-sub').textContent = C.story.sub;
$('story-body').innerHTML = C.story.paras.map(p => `<p class="lead">${esc(p)}</p>`).join('') + `<p class="note">— ${esc(C.story.by || '오마주 편집실')}</p>`;

const DET = { history: ['detail_history', '그해 오늘', () => `${Y - ago}년,<br>그해 오늘`], music: ['detail_music', '그 시절 노래', () => `${Y - ago}년,<br>그해 사랑받은 노래`], food: ['detail_food', '오늘의 한 끼', () => esc(C.meal.title)], story: ['detail_story', '오늘의 사연', () => esc(C.story.title)], fortune: ['fortune', '오늘의 운세', () => '열두 띠 운세'], follow: ['detail_follow', '오늘의 따라하기', () => '오늘, 몸을 깨우는 시간'], phrase: ['detail_phrase', '오늘의 회화', () => esc('오늘의 한 문장' + (C.phrase && C.phrase.topic ? ' · ' + C.phrase.topic : ''))], outing: ['detail_outing', '오늘의 나들이', () => '이번 주말, 어디로 갈까'], quiz: ['detail_culture', '오늘의 퀴즈', () => esc('오늘의 ' + (C.quiz.kind || '퀴즈'))] };
let cur = null;
function setTitle() { $('d-title').innerHTML = DET[cur][2](); }
function route() { const k = location.hash.slice(1); cur = DET[k] ? k : null; document.body.classList.toggle('in-detail', !!cur); stopRead(); if (cur) { $('d-bg').style.backgroundImage = `url('img/${DET[cur][0]}.jpg')`; $('d-tag').textContent = DET[cur][1]; setTitle(); document.querySelectorAll('.dsec').forEach(s => s.classList.toggle('on', s.dataset.k === cur)); window.scrollTo(0, 0); } else if (route.y != null) window.scrollTo(0, route.y); }
$('back').onclick = () => { if (route.y != null) history.back(); else location.hash = ''; };
window.addEventListener('hashchange', route);
renderEra(); route();

// ── 퀴즈 ──
$('quiz-kind').textContent = '오늘의 ' + (C.quiz.kind || '퀴즈');
$('quiz-q').textContent = C.quiz.question;
let pick = null;
function renderQuiz() {
  const s = store.get('quiz', { day: '', pick: null }), done = s.day === TODAY;
  if (done) pick = s.pick;
  $('opts').innerHTML = C.quiz.options.map((o, i) => `<button type="button" data-o="${i}" aria-pressed="${pick === i}" class="${done ? (i === C.quiz.answer ? 'ok' : 'no') : ''}" ${done ? 'disabled' : ''}>${i + 1}. ${esc(o)}</button>`).join('');
  $('quiz-check').disabled = done || pick == null; $('quiz-check').hidden = done;
  $('quiz-result').textContent = done ? (s.pick === C.quiz.answer ? '정답입니다.' : `아쉽습니다. 정답은 ${C.quiz.answer + 1}번입니다.`) : '';
  $('quiz-exp').hidden = !done; $('quiz-exp').textContent = C.quiz.explain;
}
$('opts').onclick = e => { const b = e.target.closest('[data-o]'); if (!b || b.disabled) return; pick = +b.dataset.o; renderQuiz(); };
$('quiz-check').onclick = () => { if (pick == null) return; store.set('quiz', { day: TODAY, pick }); DB.track('quiz_answer', { correct: pick === C.quiz.answer }); renderQuiz(); };
renderQuiz();

// ── 투표 · 한마디 ──
$('poll-q').textContent = C.poll.question;
function renderPoll(counts) {
  const mine = store.get('poll.' + TODAY, null), total = counts ? counts.reduce((a, b) => a + b, 0) : 0;
  $('poll').innerHTML = C.poll.options.map((o, i) => { const pct = mine != null && total ? Math.round((counts[i] || 0) * 100 / total) : null; return `<button type="button" data-p="${i}" aria-pressed="${mine === i}" ${mine != null ? 'disabled' : ''}>${pct != null ? `<i style="width:${pct}%"></i>` : ''}<span><span>${esc(o)}</span>${pct != null ? `<span>${pct}%</span>` : ''}</span></button>`; }).join('');
}
$('poll').onclick = async e => { const b = e.target.closest('[data-p]'); if (!b || b.disabled) return; const i = +b.dataset.p; store.set('poll.' + TODAY, i); renderPoll(await DB.vote(TODAY, i, C.poll.options.length)); };
DB.loadPoll(TODAY).then(renderPoll);
async function renderCmts() {
  const list = await DB.listComments(TODAY), me = DB.currentUser();
  $('cmts').innerHTML = list.map(c => `<div class="cmt"><b>${esc(c.nick)}</b><p>${esc(c.text)}</p>${me && me.uid === c.uid ? `<button type="button" data-del="${c.id}">지우기</button>` : `<button type="button" data-rep="${c.id}">신고</button>`}</div>`).join('') || '<p class="note">첫 한마디를 남겨 보세요.</p>';
}
$('cmt-form').onsubmit = async e => { e.preventDefault(); if (!DB.currentUser()) return openGate('한마디를 남기려면'); try { await DB.addComment(TODAY, $('cmt-in').value); $('cmt-in').value = ''; renderCmts(); } catch (err) { toast(err.message); } };
$('cmts').onclick = async e => { const d = e.target.closest('[data-del]'), r = e.target.closest('[data-rep]'); try { if (d) { await DB.deleteMyComment(d.dataset.del); renderCmts(); } if (r) { if (!DB.currentUser()) return openGate('신고하려면'); await DB.reportComment(r.dataset.rep); toast('신고했습니다. 확인 후 처리합니다.'); } } catch (err) { toast(err.message); } };
renderCmts();

// ── 읽어 주기 ──
const READ = { cards: () => C.greetings.join('. '), fortune: () => $('fortune').textContent, quiz: () => C.quiz.question + '. ' + C.quiz.options.map((o, i) => (i + 1) + '번, ' + o).join('. '), era: () => $('era').innerText, meal: () => C.meal.title + '. ' + C.meal.lead + ' 재료. ' + C.meal.ingredients.join(', ') + '. 만드는 법. ' + C.meal.steps.join(' '), story: () => C.story.paras.join(' ') };
// 기기에 깔린 한국어 목소리 중 가장 자연스러운 것을 고른다 (구글 > 삼성 > 나머지)
function pickVoice() {
  const vs = speechSynthesis.getVoices().filter(v => v.lang && v.lang.replace('_', '-').toLowerCase().startsWith('ko'));
  const score = v => (/google/i.test(v.name) ? 30 : 0) + (/samsung|yuna|sora/i.test(v.name) ? 20 : 0) + (/natural|neural|premium|enhanced/i.test(v.name) ? 15 : 0) + (v.localService ? 0 : 5);
  return vs.sort((a, b) => score(b) - score(a))[0];
}
try { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices(); } catch (e) {}
function stopRead() { try { speechSynthesis.cancel(); } catch (e) {} if (readingBtn) { readingBtn.textContent = '읽어 주기'; readingBtn.setAttribute('aria-pressed', 'false'); readingBtn = null; } }
document.addEventListener('click', e => {
  const b = e.target.closest('[data-read]'); if (!b) return;
  if (readingBtn === b) return stopRead();
  stopRead();
  if (!('speechSynthesis' in window)) return toast('이 기기에서는 읽어 주기를 쓸 수 없습니다.');
  const u = new SpeechSynthesisUtterance(READ[b.dataset.read]()); u.lang = 'ko-KR'; u.rate = 0.95; u.pitch = 1;
  const v = pickVoice(); if (v) u.voice = v;
  u.onend = stopRead; speechSynthesis.speak(u); readingBtn = b; b.textContent = '멈추기'; b.setAttribute('aria-pressed', 'true');
});

// ── 앱 설치 · 알리기 ──
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; });
window.addEventListener('appinstalled', () => { DB.track('installed'); $('install-btn').hidden = true; modal(`<h2>설치되었습니다</h2><p style="font-size:1.2rem">휴대폰 <b>바탕화면</b>에서 <b>오마주</b> 아이콘을 누르면 바로 열립니다.</p><p class="note">바탕화면에 안 보이면 화면을 위로 쓸어 올려 앱 목록에서 "오마주"를 찾으세요.</p><div class="modal-actions"><button type="button" class="btn green" onclick="document.getElementById('modal-root').innerHTML=''">알겠습니다</button></div>`); });
const UA = navigator.userAgent, isIOS = /iPhone|iPad|iPod/.test(UA), inApp = /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\//i.test(UA), standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
if (standalone) $('install-btn').hidden = true;
$('install-btn').onclick = async () => {
  DB.track('install_click');
  if (inApp) return modal(`<h2>크롬으로 열어 주세요</h2><p>지금은 카톡이나 네이버 앱 안에서 열려 있어서 앱 아이콘을 설치할 수 없습니다.</p>${isIOS ? '<p>오른쪽 아래(또는 위) <b>⋯</b> 또는 <b>공유</b> 버튼을 누르고 <b>"Safari로 열기"</b>를 고르세요.</p>' : `<div class="modal-actions"><a class="btn green" style="text-align:center;text-decoration:none" href="intent://${location.host}${location.pathname}?install=1#Intent;scheme=https;package=com.android.chrome;end">크롬으로 열기</a></div>`}`);
  if (deferredPrompt) {
    modal(`<h2>앱 아이콘 설치하기</h2><p style="font-size:1.2rem">화면 <b>위쪽(또는 아래쪽)</b>에 뜨는 <b>"설치"</b> 버튼을 눌러 주세요.</p><p class="note">안 보이면 이 창을 닫고 다시 눌러 주세요.</p>`);
    const p = deferredPrompt; deferredPrompt = null;
    p.prompt(); const r = await p.userChoice;
    if (r.outcome === 'accepted') { modal(`<h2>설치하는 중입니다…</h2><p style="font-size:1.2rem">잠시만 기다려 주세요.</p>`); }
    else { closeModal(); toast('설치를 취소했습니다. 언제든 다시 누르시면 됩니다.'); }
    return;
  }
  if (isIOS) return modal(`<h2>앱 아이콘 설치하기</h2><div class="steps-ios">1. 화면 아래 가운데 <b>네모에 화살표 (공유)</b> 버튼을 누르세요.<br>2. 아래로 내려 <b>"홈 화면에 추가"</b>를 누르세요.<br>3. 오른쪽 위 <b>"추가"</b>를 누르세요.</div><p class="note">바탕화면에 오마주 아이콘이 생깁니다.</p>`);
  modal(`<h2>앱 아이콘 설치하기</h2><p>크롬 오른쪽 위 <b>⋮</b> 메뉴를 누르고 <b>"홈 화면에 추가"</b> 또는 <b>"앱 설치"</b>를 누르세요.</p><p class="note">이미 설치되어 있으면 바탕화면에서 오마주 아이콘을 찾아 주세요.</p>`);
};
if (/[?&]install=1/.test(location.search) && !standalone && !inApp) {
  history.replaceState(null, '', location.pathname);
  setTimeout(() => modal(`<h2>앱 아이콘 설치하기</h2><p style="font-size:1.2rem">크롬으로 잘 넘어왔습니다. 아래 단추를 한 번 더 누르면 설치 창이 뜹니다.</p><div class="modal-actions"><button type="button" class="btn green" onclick="document.getElementById('modal-root').innerHTML='';document.getElementById('install-btn').click()">설치하기</button></div>`), 600);
}
$('share-btn').onclick = async () => {
  const text = '매일 아침 5분.\n과거와 오늘, 그리고 내일.\n마음은 아직 주니어인 당신에게.\n\n오마주';
  DB.track('share');
  if (navigator.share) { try { await navigator.share({ title: '오마주', text: text + '\n' + SITE }); } catch (e) {} }
  else { try { await navigator.clipboard.writeText(text + '\n' + SITE); toast('소개 글을 복사했습니다. 카톡에 붙여 넣어 보내세요.'); } catch (e) {} }
};

// ── 모달 ──
function modal(html, onReady) { const r = $('modal-root'); r.innerHTML = `<div class="modal" id="modal"><div class="modal-box"><button type="button" class="x" id="modal-x" aria-label="닫기">×</button>${html}</div></div>`; $('modal-x').onclick = closeModal; $('modal').onclick = e => { if (e.target.id === 'modal') closeModal(); }; if (onReady) onReady(); }
function closeModal() { $('modal-root').innerHTML = ''; }
let afterLogin = null;
function openGate(why) {
  afterLogin = null;
  modal(`<h2>간단한 회원가입을 하시면</h2><p>${why ? why + ' 회원가입이 필요합니다. ' : ''}가입하면 글 읽기와 글쓰기, 출석 도장이 됩니다. 아이디와 숫자 비밀번호면 충분합니다.</p>
  <div class="modal-actions"><button type="button" class="btn green" id="g-signup">간편 회원가입하기</button><button type="button" class="btn line" id="g-login">이미 가입했어요, 로그인</button></div>
  <div class="divider"></div><p class="note">매일 아침 바로 열어 보시려면</p><div class="modal-actions"><button type="button" class="btn ivory" id="g-install">앱 아이콘 설치하기</button></div>`,
  () => { $('g-signup').onclick = openSignup; $('g-login').onclick = openLogin; $('g-install').onclick = () => { closeModal(); $('install-btn').click(); }; });
}
const REGIONS = { '서울': ['강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구', '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구', '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구'], '경기': ['수원', '성남', '고양', '용인', '부천', '안산', '안양', '남양주', '화성', '평택', '의정부', '시흥', '파주', '김포', '광명', '광주', '군포', '하남', '오산', '양주', '이천', '구리', '안성', '포천', '의왕', '여주', '양평', '동두천', '과천', '가평', '연천'], '인천': ['중구', '동구', '미추홀구', '연수구', '남동구', '부평구', '계양구', '서구', '강화군', '옹진군'], '부산': ['중구', '서구', '동구', '영도구', '부산진구', '동래구', '남구', '북구', '해운대구', '사하구', '금정구', '강서구', '연제구', '수영구', '사상구', '기장군'], '대구': ['중구', '동구', '서구', '남구', '북구', '수성구', '달서구', '달성군', '군위군'], '광주': ['동구', '서구', '남구', '북구', '광산구'], '대전': ['동구', '중구', '서구', '유성구', '대덕구'], '울산': ['중구', '남구', '동구', '북구', '울주군'], '세종': ['세종'], '강원': ['춘천', '원주', '강릉', '동해', '태백', '속초', '삼척', '홍천', '횡성', '영월', '평창', '정선', '철원', '화천', '양구', '인제', '고성', '양양'], '충북': ['청주', '충주', '제천', '보은', '옥천', '영동', '증평', '진천', '괴산', '음성', '단양'], '충남': ['천안', '공주', '보령', '아산', '서산', '논산', '계룡', '당진', '금산', '부여', '서천', '청양', '홍성', '예산', '태안'], '전북': ['전주', '군산', '익산', '정읍', '남원', '김제', '완주', '진안', '무주', '장수', '임실', '순창', '고창', '부안'], '전남': ['목포', '여수', '순천', '나주', '광양', '담양', '곡성', '구례', '고흥', '보성', '화순', '장흥', '강진', '해남', '영암', '무안', '함평', '영광', '장성', '완도', '진도', '신안'], '경북': ['포항', '경주', '김천', '안동', '구미', '영주', '영천', '상주', '문경', '경산', '의성', '청송', '영양', '영덕', '청도', '고령', '성주', '칠곡', '예천', '봉화', '울진', '울릉'], '경남': ['창원', '진주', '통영', '사천', '김해', '밀양', '거제', '양산', '의령', '함안', '창녕', '고성', '남해', '하동', '산청', '함양', '거창', '합천'], '제주': ['제주시', '서귀포시'] };
function openSignup() {
  modal(`<h2>간편 회원가입</h2>
  <div class="field"><label>아이디</label><div class="in"><input id="s-id" autocomplete="username" inputmode="latin" placeholder="예: happy1960" maxlength="12"><button type="button" class="btn line" id="s-id-chk">중복 확인</button></div><div class="hint">영문 소문자와 숫자, 4~12자</div><div class="msg" id="s-id-msg"></div></div>
  <div class="field"><label>비밀번호</label><input id="s-pw" type="password" inputmode="numeric" placeholder="숫자 6개" maxlength="6" autocomplete="new-password"><div class="hint">숫자 6자리</div></div>
  <div class="field"><label>별명</label><div class="in"><input id="s-nick" placeholder="예: 강남 멋쟁이" maxlength="12"><button type="button" class="btn line" id="s-nick-chk">중복 확인</button></div><div class="hint">글을 쓸 때 보이는 이름</div><div class="msg" id="s-nick-msg"></div></div>
  <div class="field"><label>연락처</label><input id="s-phone" type="tel" inputmode="tel" placeholder="010-1234-5678" maxlength="13"><div class="hint">아이디나 비밀번호를 잊으셨을 때 찾는 데 필요합니다.</div></div>
  <div class="field"><label>거주 지역</label><div class="in"><select id="s-r1"><option value="">시·도</option>${Object.keys(REGIONS).map(r => `<option>${r}</option>`).join('')}</select><select id="s-r2"><option value="">구·군</option></select></div></div>
  <label class="chk"><input type="checkbox" id="s-agree"><span>개인정보 수집에 동의합니다. 아이디·비밀번호 찾기와 서비스 안내에만 쓰고, 다른 곳에 주지 않습니다. <a href="privacy.html" target="_blank">자세히</a></span></label>
  <label class="chk"><input type="checkbox" id="s-mkt"><span>(선택) 오마주 소식을 문자로 받겠습니다.</span></label>
  <div class="modal-actions"><button type="button" class="btn green" id="s-go">가입하기</button></div><div class="err-box" id="s-err" hidden></div>`,
  () => {
    $('s-r1').onchange = () => { $('s-r2').innerHTML = '<option value="">구·군</option>' + (REGIONS[$('s-r1').value] || []).map(r => `<option>${r}</option>`).join(''); };
    $('s-phone').oninput = e => { let v = e.target.value.replace(/\D/g, '').slice(0, 11); if (v.length > 7) v = v.slice(0, 3) + '-' + v.slice(3, 7) + '-' + v.slice(7); else if (v.length > 3) v = v.slice(0, 3) + '-' + v.slice(3); e.target.value = v; };
    $('s-id').oninput = e => { e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''); $('s-id-msg').textContent = ''; };
    $('s-id-chk').onclick = async () => { const u = $('s-id').value; const m = $('s-id-msg'); if (!DB.validUsername(u)) { m.className = 'msg err'; m.textContent = '영문 소문자와 숫자로 4~12자입니다.'; return; } m.className = 'msg'; m.textContent = '확인 중…'; const t = await DB.usernameTaken(u); m.className = 'msg ' + (t ? 'err' : 'ok'); m.textContent = t ? '이미 있는 아이디입니다. 다른 아이디를 넣어 주세요.' : '사용할 수 있습니다.'; };
    $('s-nick-chk').onclick = async () => { const n = $('s-nick').value.trim(); const m = $('s-nick-msg'); if (n.length < 2) { m.className = 'msg err'; m.textContent = '2자 이상 적어 주세요.'; return; } m.className = 'msg'; m.textContent = '확인 중…'; const t = await DB.nicknameTaken(n); if (t) { const s = await DB.suggestNick(n); m.className = 'msg err'; m.innerHTML = `이미 있는 별명입니다. "<b>${esc(s)}</b>"는 어떠세요? <button type="button" class="linkbtn" id="s-nick-use">이걸로 할게요</button>`; $('s-nick-use').onclick = () => { $('s-nick').value = s; m.className = 'msg ok'; m.textContent = '사용할 수 있습니다.'; }; } else { m.className = 'msg ok'; m.textContent = '사용할 수 있습니다.'; } };
    $('s-go').onclick = async () => {
      const err = $('s-err'); err.hidden = true;
      if (!$('s-agree').checked) { err.textContent = '개인정보 수집 동의에 체크해 주세요.'; err.hidden = false; return; }
      $('s-go').disabled = true; $('s-go').textContent = '가입하는 중…';
      try {
        await DB.signup({ username: $('s-id').value, pw: $('s-pw').value, nick: $('s-nick').value, phone: $('s-phone').value, region: [$('s-r1').value, $('s-r2').value].filter(Boolean).join(' '), marketing: $('s-mkt').checked });
        closeModal(); toast('가입되었습니다. 환영합니다!'); if (afterLogin) afterLogin();
      } catch (e) { err.textContent = e.message; err.hidden = false; $('s-go').disabled = false; $('s-go').textContent = '가입하기'; }
    };
  });
}
function openLogin() {
  modal(`<h2>로그인</h2>
  <div class="field"><label>아이디</label><input id="l-id" autocomplete="username" placeholder="아이디"></div>
  <div class="field"><label>비밀번호</label><input id="l-pw" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password" placeholder="숫자 6개"></div>
  <div class="modal-actions"><button type="button" class="btn green" id="l-go">로그인</button><button type="button" class="btn line" id="l-signup">처음이에요, 회원가입</button><button type="button" class="linkbtn" id="l-forgot">아이디·비밀번호를 잊었어요</button></div><div class="err-box" id="l-err" hidden></div>`,
  () => { $('l-signup').onclick = openSignup; $('l-forgot').onclick = openForgot; const go = async () => { const err = $('l-err'); err.hidden = true; try { await DB.login($('l-id').value, $('l-pw').value); closeModal(); toast('반갑습니다.'); if (afterLogin) afterLogin(); } catch (e) { err.textContent = e.message; err.hidden = false; } }; $('l-go').onclick = go; $('l-pw').onkeydown = e => { if (e.key === 'Enter') go(); }; });
}
function openForgot() {
  modal(`<h2>아이디·비밀번호 찾기</h2><p>가입할 때 적은 아이디와 휴대폰 번호를 넣어 주세요. 확인 뒤 그 번호로 연락드립니다.</p>
  <div class="field"><label>아이디</label><input id="f-id" placeholder="아이디 (모르면 비워 두세요)"></div>
  <div class="field"><label>휴대폰 번호</label><input id="f-phone" type="tel" placeholder="010-1234-5678"></div>
  <div class="modal-actions"><button type="button" class="btn green" id="f-go">찾기 요청</button></div><div class="err-box" id="f-err" hidden></div>`,
  () => { $('f-go').onclick = async () => { const err = $('f-err'); err.hidden = true; try { await DB.requestReset($('f-id').value || 'unknown', $('f-phone').value); closeModal(); toast('요청했습니다. 확인 뒤 연락드리겠습니다.'); } catch (e) { err.textContent = e.message; err.hidden = false; } }; });
}
async function openMy() {
  const p = DB.currentProfile(); if (!p) return;
  const ym = TODAY.slice(0, 7), days = await DB.myCheckins(ym), set = new Set(days.map(d => +d.slice(8)));
  const first = new Date(Y, M, 1).getDay(), last = new Date(Y, M + 1, 0).getDate();
  let cal = WD.map(w => `<div class="h">${w}</div>`).join('') + '<div></div>'.repeat(first);
  for (let d = 1; d <= last; d++) cal += `<div class="${set.has(d) ? 'on' : ''}">${d}</div>`;
  modal(`<h2>${esc(p.nick)}님의 정보</h2><p class="note">아이디 ${esc(p.username)} · 연속 ${p.streak || 0}일 · 총 ${p.checkinCount || 0}일 출석</p>
  <p class="note" style="margin-top:14px">${M + 1}월 출석</p><div class="cal">${cal}</div>
  <div class="field" style="margin-top:22px"><label>글자 크기</label><div class="in"><button type="button" class="btn line" id="m-size-big">크게</button><button type="button" class="btn line" id="m-size-normal">보통</button></div></div>
  <div class="field"><label>별명 바꾸기</label><div class="in"><input id="m-nick" value="${esc(p.nick)}" maxlength="12"><button type="button" class="btn line" id="m-nick-go">바꾸기</button></div><div class="msg" id="m-nick-msg"></div></div>
  <div class="field"><label>비밀번호 바꾸기</label><div class="in"><input id="m-pw" type="password" inputmode="numeric" maxlength="6" placeholder="새 숫자 6개"><button type="button" class="btn line" id="m-pw-go">바꾸기</button></div><div class="msg" id="m-pw-msg"></div></div>
  <div class="field"><label>태어난 해 · 성별 (선택)</label><div class="in"><input id="m-born" inputmode="numeric" maxlength="4" placeholder="예: 1960" value="${p.born || ''}"><select id="m-sex"><option value="">성별</option><option ${p.sex === '남' ? 'selected' : ''}>남</option><option ${p.sex === '여' ? 'selected' : ''}>여</option></select><button type="button" class="btn line" id="m-born-go">저장</button></div><div class="msg" id="m-born-msg"></div></div>`,
  () => {
    $('m-size-big').onclick = () => { applySize(true); store.set('big', true); toast('글자를 크게 했습니다.'); };
    $('m-size-normal').onclick = () => { applySize(false); store.set('big', false); toast('글자를 보통으로 했습니다.'); };
    $('m-nick-go').onclick = async () => { const m = $('m-nick-msg'); try { await DB.changeNick($('m-nick').value); m.className = 'msg ok'; m.textContent = '바꿨습니다.'; $('user-nick').textContent = DB.currentProfile().nick; } catch (e) { m.className = 'msg err'; m.textContent = e.message; } };
    $('m-pw-go').onclick = async () => { const m = $('m-pw-msg'); try { await DB.changePw($('m-pw').value); m.className = 'msg ok'; m.textContent = '바꿨습니다.'; } catch (e) { m.className = 'msg err'; m.textContent = e.code === 'auth/requires-recent-login' ? '안전을 위해 나갔다가 다시 로그인한 뒤 바꿔 주세요.' : e.message; } };
    $('m-born-go').onclick = async () => { const m = $('m-born-msg'); const born = +$('m-born').value; if ($('m-born').value && (born < 1920 || born > 2010)) { m.className = 'msg err'; m.textContent = '태어난 해를 다시 확인해 주세요.'; return; } try { await DB.saveProfile({ born: $('m-born').value, sex: $('m-sex').value }); m.className = 'msg ok'; m.textContent = '저장했습니다.'; } catch (e) { m.className = 'msg err'; m.textContent = e.message; } };
  });
}
$('login-btn').onclick = () => openGate('');
$('logout').onclick = async () => { await DB.logout(); toast('나갔습니다. 내일 또 뵙겠습니다.'); };
$('my').onclick = openMy;

// ── 출석 도장 ──
function renderStamp(p) {
  $('stamp-wrap').hidden = true;
  const done = p && p.lastCheckin === TODAY;
  $('stamp').disabled = !!done; $('stamp').textContent = done ? '오늘 출석 완료' : '출석 도장 찍기';
  $('streak').textContent = p ? (p.streak ? `연속 ${p.streak}일째` : '매일 찍으면 기록이 쌓입니다') : '가입하면 기록이 쌓입니다';
}
$('stamp').onclick = async () => { if (!DB.currentUser()) { afterLogin = () => $('stamp').click(); return openGate('출석 도장을 찍으려면'); } try { const s = await DB.checkin(); renderStamp(DB.currentProfile()); toast(s > 1 ? `도장을 찍었습니다. 연속 ${s}일째!` : '도장을 찍었습니다.'); } catch (e) { toast(e.message); } };
DB.onUser((u, p) => {
  $('user-chip').hidden = !u; $('login-btn').hidden = !!u;
  $('admin-btn').hidden = !(p && p.role === 'admin');
  if (p && p.role === 'admin') $('maint').hidden = true;
  if (u && p) { $('user-nick').textContent = p.nick + ' 님, ' + (new Date().getHours() < 12 ? '좋은 아침입니다.' : new Date().getHours() < 18 ? '좋은 오후입니다.' : '편안한 저녁입니다.'); if (p.zodiac && !myZ) { myZ = p.zodiac; renderZ(); } wxByRegion(p); if (p.region && !store.get('outRegion', null)) { outRegion = p.region.split(' ')[0]; renderOuting(); } }
  renderStamp(p); renderCmts();
});

// ── 세 묶음 탭 ──
$('tabs3').onclick = e => { const b = e.target.closest('[data-tab]'); if (!b) return; document.querySelectorAll('#tabs3 button').forEach(x => x.setAttribute('aria-pressed', x === b)); document.querySelectorAll('.tabsec').forEach(s => s.classList.toggle('on', s.dataset.g === b.dataset.tab)); DB.track('tab', { tab: b.dataset.tab }); const sec = document.querySelector('.tabsec.on'), y = sec.getBoundingClientRect().top + window.scrollY - 70; if (window.scrollY > y) window.scrollTo({ top: Math.max(0, y), behavior: 'auto' }); };

// ── 서비스 워커 ──
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

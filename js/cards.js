// 오늘의 인사 카드 — 계절 사진(Pixabay, 무료·출처 표기 불필요) 위에 인사말. 화면용·보내기용 같은 모양.
const SEASON = m => (m >= 3 && m <= 5) ? 'spring' : (m >= 6 && m <= 8) ? 'summer' : (m >= 9 && m <= 11) ? 'autumn' : 'winter';
let POOL = null;

async function pool() {
  if (!POOL) { try { POOL = await (await fetch('data/card_photos.json', { cache: 'no-cache' })).json(); } catch (e) { POOL = {}; } }
  return POOL;
}

// 오늘 i번째 카드 사진 (같은 계절 안에서 날마다 바뀜)
export async function photoFor(i, date = new Date()) {
  const list = (await pool())[SEASON(date.getMonth() + 1)] || [];
  if (!list.length) return 'img/autumn.jpg';
  const day = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 864e5) + date.getFullYear() * 7;
  return list[(day * 2 + i) % list.length].f;
}

function load(src) { return new Promise(r => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = src; }); }

function wrap(x, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const ch of para.split(' ')) { const t = line ? line + ' ' + ch : ch; if (x.measureText(t).width > maxW && line) { out.push(line); line = ch; } else line = t; }
    if (line) out.push(line);
  }
  return out;
}

// 보내기용 카드 (1080×1350)
export async function drawCard(text, i, { dateText = '' } = {}) {
  const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  const [img, logo] = await Promise.all([load(await photoFor(i)), load('logo-light.png')]);
  if (img) { const s = Math.max(W / img.width, H / img.height); x.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s); }
  else { x.fillStyle = '#C9A24A'; x.fillRect(0, 0, W, H); }
  const g = x.createLinearGradient(0, H * 0.35, 0, H); g.addColorStop(0, 'rgba(20,16,10,0)'); g.addColorStop(0.55, 'rgba(20,16,10,0.45)'); g.addColorStop(1, 'rgba(20,16,10,0.78)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  if (logo) { const lw = 210; x.globalAlpha = 0.95; x.drawImage(logo, W - lw - 56, 50, lw, lw * logo.height / logo.width); x.globalAlpha = 1; }
  // 글자 조각(한글 묶음)을 문장에 맞춰 모두 받아 둔 뒤 그려야 글씨가 섞여 깨지지 않음
  const tail = `${dateText}·오마주 omaju.kr`;
  try { await Promise.all([document.fonts.load('800 76px "Nanum Myeongjo"', text), document.fonts.load('500 32px "Noto Sans KR"', tail)]); } catch (e) {}
  x.fillStyle = '#fff'; x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.shadowColor = 'rgba(0,0,0,0.45)'; x.shadowBlur = 14;
  let fs = 76, lines; for (; fs > 52; fs -= 4) { x.font = `800 ${fs}px "Nanum Myeongjo", serif`; lines = wrap(x, text, W - 150); if (lines.length <= 4) break; }
  const lh = fs * 1.45, bottom = H - 170; lines.forEach((l, k) => x.fillText(l, 75, bottom - (lines.length - 1 - k) * lh));
  x.shadowBlur = 0; x.fillStyle = 'rgba(255,255,255,0.85)'; x.fillRect(75, H - 118, 60, 2);
  x.font = '500 32px "Noto Sans KR", sans-serif'; x.fillStyle = 'rgba(255,255,255,0.92)'; x.fillText(`${dateText}   ·   오마주 omaju.kr`, 75, H - 68);
  return cv;
}

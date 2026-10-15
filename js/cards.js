// 오늘의 인사 카드 — 계절에 맞는 밝고 따뜻한 그림 카드 (화면용·보내기용 같은 그림)
const SEASON = m => (m >= 3 && m <= 5) ? 'spring' : (m >= 6 && m <= 8) ? 'summer' : (m >= 9 && m <= 11) ? 'autumn' : 'winter';

// 계절마다 4가지 — [위 색, 아래 색, 그림, 글자색, 무늬색들]
const THEMES = {
  spring: [
    ['#FFF0F3', '#FFD3DE', 'blossom', '#5A2338', ['#FF9FB7', '#FFC2D1', '#FFFFFF']],
    ['#F4FBE6', '#D9F0B4', 'tulip', '#2F4415', ['#FF8A7A', '#FFC94D', '#8CCB5E']],
    ['#FFFBE3', '#FFEC9E', 'sun', '#4A3500', ['#FFC93C', '#FFE07A', '#FFF6CC']],
    ['#F6F0FF', '#E3D5FF', 'blossom', '#3B2563', ['#C9A8FF', '#FFC2D1', '#FFFFFF']],
  ],
  summer: [
    ['#E8F7FF', '#BDE7FF', 'sun', '#123E5A', ['#FFC93C', '#FFE07A', '#FFFFFF']],
    ['#FFFBE0', '#FFE992', 'citrus', '#4A3500', ['#FFB627', '#FFD45C', '#7CC46B']],
    ['#FFF0E6', '#FFD0B5', 'wave', '#5A2A12', ['#FF9A6B', '#FFC9A6', '#FFFFFF']],
    ['#ECFBF5', '#C3F0DD', 'leaf', '#164536', ['#5FC48F', '#9BE0B9', '#FFE07A']],
  ],
  autumn: [
    ['#FFF1DE', '#FFCF96', 'maple', '#5A2A0C', ['#F2683A', '#FF9548', '#FFC15A']],
    ['#FFFAE0', '#FFE58A', 'ginkgo', '#4A3500', ['#F7C531', '#FFD95A', '#E8A92A']],
    ['#FFEDE8', '#FFC6B6', 'cosmos', '#5A1E2A', ['#FF7FA0', '#FFB3C6', '#FFE07A']],
    ['#FFF4E4', '#FFD9A8', 'sun', '#5A2A0C', ['#FFB23F', '#FFD27A', '#FFF1C9']],
  ],
  winter: [
    ['#FFF6EC', '#FFDCC4', 'camellia', '#5A1E1E', ['#E8424F', '#FF8A8F', '#5E9E6B']],
    ['#FFFBEA', '#FFEBB0', 'sun', '#4A3500', ['#FFC93C', '#FFE07A', '#FFFFFF']],
    ['#FFF0F2', '#FFD1DA', 'snow', '#5A2338', ['#FFFFFF', '#FFB3C2', '#FFE07A']],
    ['#EEF6FF', '#CFE4FF', 'snow', '#173A63', ['#FFFFFF', '#FFE07A', '#FFB3C2']],
  ],
};

function rnd(seed) { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }

function petalFlower(x, cx, cy, r, n, c1, c2) {
  x.save(); x.translate(cx, cy); x.fillStyle = c1;
  for (let k = 0; k < n; k++) { x.rotate(Math.PI * 2 / n); x.beginPath(); x.ellipse(0, -r * 0.55, r * 0.32, r * 0.55, 0, 0, Math.PI * 2); x.fill(); }
  x.fillStyle = c2; x.beginPath(); x.arc(0, 0, r * 0.22, 0, Math.PI * 2); x.fill(); x.restore();
}
const MAPLE = [[0,-1],[0.12,-0.62],[0.34,-0.78],[0.3,-0.42],[0.72,-0.6],[0.58,-0.22],[0.95,-0.12],[0.5,0.12],[0.6,0.36],[0.18,0.28],[0.06,0.5],[0,0.42],[-0.06,0.5],[-0.18,0.28],[-0.6,0.36],[-0.5,0.12],[-0.95,-0.12],[-0.58,-0.22],[-0.72,-0.6],[-0.3,-0.42],[-0.34,-0.78],[-0.12,-0.62]];
function maple(x, cx, cy, r, rot, c) {
  x.save(); x.translate(cx, cy); x.rotate(rot); x.fillStyle = c; x.beginPath();
  MAPLE.forEach(([px, py], k) => k ? x.lineTo(px * r, py * r) : x.moveTo(px * r, py * r)); x.closePath(); x.fill();
  x.strokeStyle = c; x.lineWidth = r * 0.07; x.lineCap = 'round'; x.beginPath(); x.moveTo(0, r * 0.4); x.lineTo(r * 0.05, r * 0.95); x.stroke();
  x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = r * 0.04; [[0, -0.8], [0.6, -0.45], [-0.6, -0.45], [0.75, -0.1], [-0.75, -0.1]].forEach(([px, py]) => { x.beginPath(); x.moveTo(0, r * 0.3); x.lineTo(px * r * 0.85, py * r * 0.85); x.stroke(); });
  x.restore();
}
function ginkgo(x, cx, cy, r, rot, c) {
  x.save(); x.translate(cx, cy); x.rotate(rot); x.fillStyle = c; x.beginPath(); x.moveTo(0, 0);
  x.arc(0, 0, r, -Math.PI * 0.85, -Math.PI * 0.15); x.closePath(); x.fill();
  x.fillStyle = 'rgba(255,255,255,0.35)'; x.beginPath(); x.moveTo(0, -r * 0.15); x.lineTo(-r * 0.04, -r); x.lineTo(r * 0.04, -r); x.closePath(); x.fill();
  x.strokeStyle = c; x.lineWidth = r * 0.07; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, r * 0.55); x.stroke(); x.restore();
}
function leaf(x, cx, cy, r, rot, c) {
  x.save(); x.translate(cx, cy); x.rotate(rot); x.fillStyle = c; x.beginPath(); x.moveTo(0, -r);
  x.quadraticCurveTo(r * 0.7, 0, 0, r); x.quadraticCurveTo(-r * 0.7, 0, 0, -r); x.fill();
  x.strokeStyle = 'rgba(255,255,255,0.45)'; x.lineWidth = r * 0.05; x.beginPath(); x.moveTo(0, -r * 0.8); x.lineTo(0, r * 0.9); x.stroke(); x.restore();
}
function sun(x, cx, cy, r, c1, c2) {
  const g = x.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.4); g.addColorStop(0, c2); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r * 2.4, 0, Math.PI * 2); x.fill();
  x.save(); x.translate(cx, cy); x.strokeStyle = c1; x.lineCap = 'round'; x.lineWidth = r * 0.12;
  for (let k = 0; k < 12; k++) { x.rotate(Math.PI / 6); x.beginPath(); x.moveTo(0, -r * 1.25); x.lineTo(0, -r * 1.6); x.stroke(); }
  x.restore(); x.fillStyle = c1; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
}
function sparkle(x, cx, cy, r, c) {
  x.save(); x.translate(cx, cy); x.fillStyle = c; x.beginPath();
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? r * 0.25 : r; x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  x.closePath(); x.fill(); x.restore();
}
function citrus(x, cx, cy, r, c1, c2) {
  x.fillStyle = c1; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
  x.fillStyle = c2; x.beginPath(); x.arc(cx, cy, r * 0.82, 0, Math.PI * 2); x.fill();
  x.strokeStyle = c1; x.lineWidth = r * 0.06; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8); x.stroke(); }
}

function decorate(x, W, H, kind, cols, seed) {
  const R = rnd(seed + 7), S = W / 1080;
  const [a, b, c] = cols;
  if (kind === 'sun') {
    sun(x, W * 0.78, H * 0.17, 95 * S, a, b);
    for (let k = 0; k < 9; k++) sparkle(x, W * (0.08 + R() * 0.84), H * (0.06 + R() * 0.42), (14 + R() * 18) * S, c);
  } else if (kind === 'maple' || kind === 'ginkgo' || kind === 'leaf') {
    const f = kind === 'maple' ? maple : kind === 'ginkgo' ? ginkgo : leaf;
    sun(x, W * 0.82, H * 0.12, 70 * S, '#FFD45C', 'rgba(255,240,190,0.9)');
    for (let k = 0; k < 13; k++) f(x, W * (0.04 + R() * 0.92), H * (0.03 + R() * 0.45), (34 + R() * 46) * S, R() * 6.28, cols[k % 3]);
  } else if (kind === 'blossom' || kind === 'cosmos' || kind === 'camellia' || kind === 'tulip') {
    const n = kind === 'cosmos' ? 8 : kind === 'camellia' ? 6 : 5;
    for (let k = 0; k < 11; k++) {
      const r = (40 + R() * 55) * S, cx = W * (0.04 + R() * 0.92), cy = H * (0.03 + R() * 0.45);
      if (kind === 'camellia' && k % 3 === 2) leaf(x, cx, cy, r * 0.8, R() * 6.28, c);
      else petalFlower(x, cx, cy, r, n, k % 2 ? b : a, kind === 'camellia' ? '#FFD45C' : (kind === 'tulip' ? '#FFFFFF' : '#FFE07A'));
    }
    for (let k = 0; k < 6; k++) sparkle(x, W * (0.1 + R() * 0.8), H * (0.05 + R() * 0.4), (10 + R() * 12) * S, '#FFFFFF');
  } else if (kind === 'citrus') {
    for (let k = 0; k < 7; k++) { const r = (45 + R() * 40) * S, cx = W * (0.06 + R() * 0.88), cy = H * (0.04 + R() * 0.42); k % 3 === 2 ? leaf(x, cx, cy, r, R() * 6.28, c) : citrus(x, cx, cy, r, a, b); }
  } else if (kind === 'wave') {
    sun(x, W * 0.5, H * 0.2, 90 * S, '#FFC93C', 'rgba(255,240,190,0.9)');
    for (let k = 0; k < 3; k++) { x.fillStyle = k === 1 ? b : (k ? c : a); x.globalAlpha = 0.55 + k * 0.15; x.beginPath(); const y0 = H * (0.38 + k * 0.05); x.moveTo(0, y0); for (let i = 0; i <= 6; i++) x.quadraticCurveTo(W * (i + 0.5) / 6, y0 + (i % 2 ? -26 : 26) * S, W * (i + 1) / 6, y0); x.lineTo(W, y0 + 60 * S); x.lineTo(0, y0 + 60 * S); x.fill(); }
    x.globalAlpha = 1;
  } else if (kind === 'snow') {
    sun(x, W * 0.8, H * 0.15, 75 * S, '#FFD45C', 'rgba(255,245,210,0.9)');
    for (let k = 0; k < 26; k++) { x.fillStyle = cols[k % 3]; x.globalAlpha = 0.9; x.beginPath(); x.arc(W * R(), H * R() * 0.5, (6 + R() * 14) * S, 0, Math.PI * 2); x.fill(); }
    x.globalAlpha = 1; for (let k = 0; k < 6; k++) sparkle(x, W * (0.1 + R() * 0.8), H * (0.05 + R() * 0.4), (16 + R() * 14) * S, '#FFFFFF');
  }
}

function wrapLines(x, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const w of para.split(' ')) { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
    if (line) out.push(line);
  }
  return out;
}

export function theme(i, month) { const list = THEMES[SEASON(month)]; return list[i % list.length]; }

// 카드 그리기. full=true면 보내기용(날짜·주소 포함)
export async function drawCard(text, i, { W = 1080, H = 1350, month, dateText = '', full = false } = {}) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  const [top, bottom, kind, ink, cols] = theme(i, month), S = W / 1080;
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, bottom); x.fillStyle = g; x.fillRect(0, 0, W, H);
  decorate(x, W, H, kind, cols, i * 31 + month);
  try { await document.fonts.load('700 80px Gaegu'); } catch (e) {}
  // 글자 바탕: 부드러운 흰 띠
  x.fillStyle = 'rgba(255,255,255,0.55)';
  const boxY = H * 0.52, boxH = H * 0.36; x.beginPath(); x.roundRect ? x.roundRect(W * 0.06, boxY, W * 0.88, boxH, 40 * S) : x.rect(W * 0.06, boxY, W * 0.88, boxH); x.fill();
  x.fillStyle = ink; x.textAlign = 'center'; x.textBaseline = 'middle';
  let fs = 92 * S, lines;
  for (; fs > 54 * S; fs -= 4 * S) { x.font = `700 ${fs}px Gaegu, "Noto Sans KR", sans-serif`; lines = wrapLines(x, text, W * 0.78); if (lines.length * fs * 1.25 <= boxH * 0.86) break; }
  const lh = fs * 1.25, y0 = boxY + boxH / 2 - (lines.length - 1) * lh / 2;
  lines.forEach((l, k) => x.fillText(l, W / 2, y0 + k * lh));
  x.font = `700 ${34 * S}px "Noto Sans KR", sans-serif`; x.fillStyle = ink; x.globalAlpha = 0.85;
  if (full) x.fillText(`${dateText}  ·  오마주 omaju.kr`, W / 2, H * 0.94); x.globalAlpha = 1;
  return cv;
}

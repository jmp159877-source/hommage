import * as DB from './db.js';
import { DEFAULT_CONTENT } from './content.js';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, query, where, orderBy, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const db = DB.db, TODAY = DB.todayKey();
const fmt = ts => ts && ts.toDate ? ts.toDate().toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
const dayOffset = n => { const d = new Date(); d.setDate(d.getDate() + n); return DB.todayKey(d); };

$('a-go').onclick = async () => { $('err').textContent = ''; try { await DB.login($('a-id').value, $('a-pw').value); } catch (e) { $('err').textContent = e.message; } };
$('a-pw').onkeydown = e => { if (e.key === 'Enter') $('a-go').click(); };
$('a-out').onclick = () => DB.logout();
DB.onUser((u, p) => {
  const ok = u && p && p.role === 'admin';
  $('gate').hidden = !!ok; $('panel').hidden = !ok;
  if (u && !ok) { $('err').textContent = '관리자 권한이 없는 계정입니다.'; DB.logout(); }
  if (ok) { $('who').textContent = p.nick; loadDash(); }
});
document.querySelector('.tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (!b) return; document.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-pressed', x === b)); document.querySelectorAll('.sec').forEach(s => s.classList.toggle('on', s.dataset.sec === b.dataset.tab)); ({ users: loadUsers, content: () => { $('c-date').value = TODAY; loadContent(); }, comments: () => { $('m-date').value = TODAY; loadComments(false); }, resets: loadResets, notice: loadNotice })[b.dataset.tab]?.(); };

// ── 현황 ──
async function loadDash() {
  const users = (await getDocs(collection(db, 'users'))).docs.map(d => d.data());
  const today = users.filter(u => u.lastSeenDay === TODAY).length;
  const week = users.filter(u => u.lastSeenDay >= dayOffset(-6)).length;
  const sToday = (await getDoc(doc(db, 'stats', TODAY))).data() || {};
  $('tiles').innerHTML = [['누적 가입자', users.length], ['오늘 방문(기기)', sToday.visits || 0], ['오늘 접속 회원', today], ['7일 접속 회원', week], ['오늘 가입', users.filter(u => u.createdAt && DB.todayKey(u.createdAt.toDate()) === TODAY).length], ['문자 수신 동의', users.filter(u => u.marketing).length]].map(([k, v]) => `<div class="tile"><b>${v}</b><span>${k}</span></div>`).join('');
  const days = Array.from({ length: 14 }, (_, i) => dayOffset(i - 13));
  const stats = await Promise.all(days.map(d => getDoc(doc(db, 'stats', d)).then(s => s.data() || {})));
  const max = Math.max(1, ...stats.map(s => s.visits || 0));
  $('chart').innerHTML = stats.map((s, i) => `<div style="height:${(s.visits || 0) * 100 / max}%" data-v="${s.visits || 0}" title="${days[i]}"></div>`).join('');
  const clicks = Object.entries(sToday.clicks || {}).sort((a, b) => b[1] - a[1]);
  const NAMES = { greeting: '인사말', fortune: '운세', food: '한 끼', quiz: '퀴즈', history: '그해 오늘', music: '그 시절 노래', story: '사연' };
  $('clicks').innerHTML = '<tr><th>코너</th><th>클릭</th></tr>' + (clicks.map(([k, v]) => `<tr><td>${NAMES[k] || k}</td><td>${v}</td></tr>`).join('') || '<tr><td colspan="2">아직 없음</td></tr>');
  const reg = {}; users.forEach(u => { const r = (u.region || '미입력').split(' ')[0]; reg[r] = (reg[r] || 0) + 1; });
  $('regions').innerHTML = '<tr><th>지역</th><th>가입자</th></tr>' + Object.entries(reg).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('');
}

// ── 회원 ──
let allUsers = [];
async function loadUsers() {
  allUsers = (await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')))).docs.map(d => ({ id: d.id, ...d.data() }));
  renderUsers(allUsers);
}
function renderUsers(list) {
  $('u-count').textContent = list.length + '명';
  $('users').innerHTML = '<tr><th>별명</th><th>아이디</th><th>연락처</th><th>지역</th><th>가입</th><th>마지막</th><th>출석</th><th></th></tr>' + list.slice(0, 300).map(u => `<tr><td>${esc(u.nick)}${u.role === 'admin' ? ' <small>(관리자)</small>' : ''}${u.banned ? ' <small style="color:#a93226">(정지)</small>' : ''}</td><td>${esc(u.username)}</td><td>${esc(u.phone)}</td><td>${esc(u.region)}</td><td>${fmt(u.createdAt)}</td><td>${esc(u.lastSeenDay)}</td><td>${u.checkinCount || 0}</td><td>${u.role === 'admin' ? '' : `<button type="button" data-ban="${u.id}" class="${u.banned ? '' : 'danger'}">${u.banned ? '정지 풀기' : '정지'}</button>`}</td></tr>`).join('');
}
$('u-find').onclick = () => { const q = $('u-q').value.trim().toLowerCase(); renderUsers(q ? allUsers.filter(u => [u.nick, u.username, u.phone].some(x => (x || '').toLowerCase().includes(q))) : allUsers); };
$('users').onclick = async e => { const b = e.target.closest('[data-ban]'); if (!b) return; const u = allUsers.find(x => x.id === b.dataset.ban); if (!confirm((u.banned ? '정지를 풀까요? ' : '이 회원을 정지할까요? ') + u.nick)) return; await updateDoc(doc(db, 'users', u.id), { banned: !u.banned }); loadUsers(); };

// ── 오늘 콘텐츠 ──
async function loadContent() {
  const d = $('c-date').value; const s = await getDoc(doc(db, 'daily', d));
  $('c-json').value = JSON.stringify(s.exists() ? s.data() : DEFAULT_CONTENT, null, 2);
  $('c-msg').textContent = s.exists() ? '저장된 내용을 불러왔습니다.' : '저장된 것이 없어 기본 내용을 보여 줍니다.';
}
$('c-load').onclick = loadContent;
$('c-default').onclick = () => { $('c-json').value = JSON.stringify(DEFAULT_CONTENT, null, 2); };
$('c-save').onclick = async () => {
  let data; try { data = JSON.parse($('c-json').value); } catch (e) { $('c-msg').textContent = '모양이 틀렸습니다. 따옴표나 쉼표를 확인해 주세요. (' + e.message + ')'; return; }
  await setDoc(doc(db, 'daily', $('c-date').value), data); $('c-msg').textContent = $('c-date').value + ' 저장했습니다.';
};

// ── 한마디·신고 ──
async function loadComments(onlyReported) {
  const q = onlyReported ? query(collection(db, 'comments'), where('reports', '>', 0), orderBy('reports', 'desc'), limit(100)) : query(collection(db, 'comments'), where('date', '==', $('m-date').value));
  const list = (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
  $('comments').innerHTML = '<tr><th>날짜</th><th>별명</th><th>내용</th><th>신고</th><th></th></tr>' + (list.map(c => `<tr style="${c.hidden ? 'opacity:.5' : ''}"><td>${esc(c.date)}</td><td>${esc(c.nick)}</td><td>${esc(c.text)}</td><td>${c.reports || 0}</td><td><button type="button" data-hide="${c.id}" data-h="${c.hidden ? 0 : 1}">${c.hidden ? '다시 보이기' : '숨기기'}</button><button type="button" data-rm="${c.id}" class="danger">삭제</button></td></tr>`).join('') || '<tr><td colspan="5">없음</td></tr>');
}
$('m-load').onclick = () => loadComments(false); $('m-reported').onclick = () => loadComments(true);
$('comments').onclick = async e => { const h = e.target.closest('[data-hide]'), r = e.target.closest('[data-rm]'); if (h) await updateDoc(doc(db, 'comments', h.dataset.hide), { hidden: h.dataset.h === '1' }); if (r && confirm('삭제할까요?')) await deleteDoc(doc(db, 'comments', r.dataset.rm)); if (h || r) loadComments(false); };

// ── 찾기 요청 ──
async function loadResets() {
  const list = (await getDocs(query(collection(db, 'resets'), orderBy('ts', 'desc'), limit(100)))).docs.map(d => ({ id: d.id, ...d.data() }));
  const rows = await Promise.all(list.map(async r => { let m = '아이디 없음'; if (r.username && r.username !== 'unknown') { const u = await getDoc(doc(db, 'usernames', r.username)); if (u.exists()) { const p = (await getDoc(doc(db, 'users', u.data().uid))).data(); m = p ? (p.phone === r.phone ? '연락처 일치 ✓ (' + esc(p.nick) + ')' : '연락처 불일치 ✗') : '회원 정보 없음'; } } return `<tr style="${r.done ? 'opacity:.5' : ''}"><td>${fmt(r.ts)}</td><td>${esc(r.username)}</td><td>${esc(r.phone)}</td><td>${m}</td><td>${r.done ? '완료' : `<button type="button" data-done="${r.id}">처리 완료</button>`}</td></tr>`; }));
  $('resets').innerHTML = '<tr><th>요청</th><th>아이디</th><th>연락처</th><th>확인</th><th></th></tr>' + (rows.join('') || '<tr><td colspan="5">없음</td></tr>');
}
$('resets').onclick = async e => { const b = e.target.closest('[data-done]'); if (!b) return; await updateDoc(doc(db, 'resets', b.dataset.done), { done: true }); loadResets(); };

// ── 공지 ──
async function loadNotice() { const n = await DB.loadNotice(); $('n-text').value = n ? n.text : ''; }
$('n-save').onclick = async () => { const t = $('n-text').value.trim(); if (!t) return; const old = await getDocs(query(collection(db, 'notices'), where('active', '==', true))); await Promise.all(old.docs.map(d => updateDoc(d.ref, { active: false }))); await addDoc(collection(db, 'notices'), { text: t, active: true, ts: serverTimestamp() }); $('n-msg').textContent = '올렸습니다.'; };
$('n-off').onclick = async () => { const old = await getDocs(query(collection(db, 'notices'), where('active', '==', true))); await Promise.all(old.docs.map(d => updateDoc(d.ref, { active: false }))); $('n-text').value = ''; $('n-msg').textContent = '내렸습니다.'; };

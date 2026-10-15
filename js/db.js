// 오마주 — 파이어베이스 연결 (가입·로그인·저장)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, limit, getDocs, runTransaction, serverTimestamp, increment, deleteField } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';
import { getAnalytics, logEvent } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-analytics.js';
import { firebaseConfig } from '../firebase-config.js';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
let analytics = null;
try { analytics = getAnalytics(app); } catch (e) {}
setPersistence(auth, browserLocalPersistence).catch(() => {});

const DOMAIN = '@omaju.kr';
export const ADMIN_ROLE = 'admin';

export const todayKey = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const normNick = s => s.replace(/\s+/g, '').toLowerCase();
export const validUsername = s => /^[a-z0-9]{4,12}$/.test(s);
export const validPw = s => /^[0-9]{6}$/.test(s);
export const validPhone = s => /^01[016789]-?\d{3,4}-?\d{4}$/.test(s);

// ── 로그인 상태 ──
let me = null, profile = null;
const listeners = new Set();
export function onUser(cb) { listeners.add(cb); cb(me, profile); return () => listeners.delete(cb); }
onAuthStateChanged(auth, async user => {
  me = user; profile = null;
  if (user) {
    try { const s = await getDoc(doc(db, 'users', user.uid)); profile = s.exists() ? s.data() : null; } catch (e) {}
    if (!profile) return; // 가입 직후: 프로필이 써지면 signup()이 직접 알린다
    try { await updateDoc(doc(db, 'users', user.uid), { lastSeen: serverTimestamp(), lastSeenDay: todayKey() }); } catch (e) {}
  }
  listeners.forEach(cb => cb(me, profile));
});
export const currentUser = () => me;
export const currentProfile = () => profile;
export const isAdmin = () => !!(profile && profile.role === ADMIN_ROLE);

// ── 중복 확인 ──
export async function usernameTaken(u) { const s = await getDoc(doc(db, 'usernames', u)); return s.exists(); }
export async function nicknameTaken(n) { const s = await getDoc(doc(db, 'nicknames', normNick(n))); return s.exists(); }
export async function suggestNick(n) {
  for (let i = 2; i < 50; i++) { const c = n + i; if (!(await nicknameTaken(c))) return c; }
  return n + Math.floor(Math.random() * 9000 + 1000);
}

// ── 가입 ──
export async function signup({ username, pw, nick, phone, region, marketing }) {
  username = username.trim().toLowerCase(); nick = nick.trim();
  if (!validUsername(username)) throw new Error('아이디는 영문 소문자와 숫자로 4~12자입니다.');
  if (!validPw(pw)) throw new Error('비밀번호는 숫자 6자리입니다.');
  if (nick.length < 2 || nick.length > 12) throw new Error('별명은 2~12자로 적어 주세요.');
  if (!validPhone(phone)) throw new Error('휴대폰 번호를 다시 확인해 주세요. 예: 010-1234-5678');
  if (await usernameTaken(username)) throw new Error('이미 있는 아이디입니다. 다른 아이디를 넣어 주세요.');
  if (await nicknameTaken(nick)) throw new Error('이미 있는 별명입니다. 다른 별명을 넣어 주세요.');
  const cred = await createUserWithEmailAndPassword(auth, username + DOMAIN, pw);
  const uid = cred.user.uid;
  await runTransaction(db, async tx => {
    const u = doc(db, 'usernames', username), n = doc(db, 'nicknames', normNick(nick));
    if ((await tx.get(u)).exists()) throw new Error('이미 있는 아이디입니다.');
    if ((await tx.get(n)).exists()) throw new Error('이미 있는 별명입니다.');
    tx.set(u, { uid }); tx.set(n, { uid });
    tx.set(doc(db, 'users', uid), {
      username, nick, nickKey: normNick(nick), phone: phone.replace(/-/g, ''), region: region || '', role: 'member',
      marketing: !!marketing, agreedAt: serverTimestamp(), createdAt: serverTimestamp(), lastSeen: serverTimestamp(), lastSeenDay: todayKey(),
      streak: 0, lastCheckin: ''
    });
  });
  profile = { username, nick, nickKey: normNick(nick), phone: phone.replace(/-/g, ''), region: region || '', role: 'member', marketing: !!marketing, streak: 0, lastCheckin: '', checkinCount: 0 };
  listeners.forEach(cb => cb(me, profile));
  track('sign_up');
  return uid;
}

export async function login(username, pw) {
  username = username.trim().toLowerCase();
  try { await signInWithEmailAndPassword(auth, username + DOMAIN, pw); }
  catch (e) { throw new Error('아이디나 비밀번호가 맞지 않습니다.'); }
  track('login');
}
export const logout = () => signOut(auth);

export async function changeNick(nick) {
  if (!me) throw new Error('로그인이 필요합니다.');
  nick = nick.trim();
  if (nick.length < 2 || nick.length > 12) throw new Error('별명은 2~12자로 적어 주세요.');
  if (normNick(nick) === profile.nickKey) return;
  if (await nicknameTaken(nick)) throw new Error('이미 있는 별명입니다.');
  await runTransaction(db, async tx => {
    const n = doc(db, 'nicknames', normNick(nick));
    if ((await tx.get(n)).exists()) throw new Error('이미 있는 별명입니다.');
    tx.set(n, { uid: me.uid }); tx.delete(doc(db, 'nicknames', profile.nickKey));
    tx.update(doc(db, 'users', me.uid), { nick, nickKey: normNick(nick) });
  });
  profile.nick = nick; profile.nickKey = normNick(nick);
}
export async function saveProfile(fields) {
  if (!me) throw new Error('로그인이 필요합니다.');
  await updateDoc(doc(db, 'users', me.uid), fields); Object.assign(profile, fields);
}
export async function changePw(pw) {
  if (!validPw(pw) && !(isAdmin() && pw.length >= 8)) throw new Error('비밀번호는 숫자 6자리입니다.');
  await updatePassword(me, pw);
}
export async function requestReset(username, phone) {
  username = username.trim().toLowerCase();
  if (!validUsername(username) || !validPhone(phone)) throw new Error('아이디와 휴대폰 번호를 다시 확인해 주세요.');
  await addDoc(collection(db, 'resets'), { username, phone: phone.replace(/-/g, ''), ts: serverTimestamp(), done: false });
}

// ── 출석 ──
export async function checkin() {
  if (!me) throw new Error('로그인이 필요합니다.');
  const today = todayKey(), y = new Date(); y.setDate(y.getDate() - 1);
  const ref = doc(db, 'checkins', me.uid + '_' + today);
  if ((await getDoc(ref)).exists()) return profile.streak;
  const streak = profile.lastCheckin === todayKey(y) ? (profile.streak || 0) + 1 : 1;
  await setDoc(ref, { uid: me.uid, date: today, ts: serverTimestamp() });
  await updateDoc(doc(db, 'users', me.uid), { streak, lastCheckin: today, checkinCount: increment(1) });
  profile.streak = streak; profile.lastCheckin = today; profile.checkinCount = (profile.checkinCount || 0) + 1;
  track('checkin');
  return streak;
}
export async function myCheckins(yyyymm) {
  if (!me) return [];
  const q = query(collection(db, 'checkins'), where('uid', '==', me.uid));
  return (await getDocs(q)).docs.map(d => d.data().date).filter(d => d.startsWith(yyyymm));
}

// ── 오늘 콘텐츠·공지 ──
export async function loadDaily(date = todayKey()) {
  try { const s = await getDoc(doc(db, 'daily', date)); return s.exists() ? s.data() : null; } catch (e) { return null; }
}
export async function loadMaint() {
  try { const s = await getDoc(doc(db, 'settings', 'maint')); return s.exists() ? s.data() : null; } catch (e) { return null; }
}
export async function loadMarket() {
  try { const s = await getDoc(doc(db, 'settings', 'market')); return s.exists() ? s.data() : null; } catch (e) { return null; }
}
export async function loadNotice() {
  try {
    const s = await getDocs(query(collection(db, 'notices'), where('active', '==', true)));
    return s.empty ? null : s.docs[s.docs.length - 1].data();
  } catch (e) { return null; }
}

// ── 투표·한마디 ──
export async function vote(date, idx, n) {
  const ref = doc(db, 'polls', date);
  if (me) {
    const v = doc(db, 'votes', date + '_' + me.uid);
    if ((await getDoc(v)).exists()) return loadPoll(date);
    await setDoc(v, { uid: me.uid, date, idx, ts: serverTimestamp() });
  }
  const s = await getDoc(ref);
  if (!s.exists()) await setDoc(ref, { counts: Array.from({ length: n }, (_, i) => i === idx ? 1 : 0) });
  else await updateDoc(ref, { ['counts.' + idx]: increment(1) });
  return loadPoll(date);
}
export async function loadPoll(date) {
  try { const s = await getDoc(doc(db, 'polls', date)); return s.exists() ? s.data().counts : null; } catch (e) { return null; }
}
export async function addComment(date, text) {
  if (!me || !profile) throw new Error('로그인이 필요합니다.');
  text = text.trim(); if (!text) return;
  if (text.length > 200) throw new Error('200자 안으로 적어 주세요.');
  if (BAD.some(w => text.includes(w))) throw new Error('고운 말로 다시 적어 주세요.');
  await addDoc(collection(db, 'comments'), { uid: me.uid, nick: profile.nick, date, text, ts: serverTimestamp(), reports: 0, hidden: false });
}
export async function listComments(date) {
  try {
    const q = query(collection(db, 'comments'), where('date', '==', date));
    const ms = x => x && x.ts && x.ts.toMillis ? x.ts.toMillis() : 0;
    return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() })).filter(c => !c.hidden).sort((a, b) => ms(b) - ms(a)).slice(0, 50);
  } catch (e) { return []; }
}
export async function reportComment(id) {
  if (!me) throw new Error('로그인이 필요합니다.');
  const r = doc(db, 'reports', id + '_' + me.uid);
  if ((await getDoc(r)).exists()) return;
  await setDoc(r, { uid: me.uid, comment: id, ts: serverTimestamp() });
  await updateDoc(doc(db, 'comments', id), { reports: increment(1) });
}
export async function deleteMyComment(id) { await deleteDoc(doc(db, 'comments', id)); }
const BAD = ['시발', '씨발', '개새', '병신', '좆', '니미', '썅'];

// ── 집계 ──
export async function bumpVisit() {
  const k = 'omaju.visit.' + todayKey();
  try { if (localStorage.getItem(k)) return; localStorage.setItem(k, '1'); } catch (e) {}
  try { await setDoc(doc(db, 'stats', todayKey()), { visits: increment(1) }, { merge: true }); } catch (e) {}
}
export async function bumpClick(corner) {
  try { await setDoc(doc(db, 'stats', todayKey()), { ['clicks.' + corner]: increment(1) }, { merge: true }); } catch (e) {}
  track('corner_open', { corner });
}
export function track(name, params) { try { if (analytics) logEvent(analytics, name, params || {}); } catch (e) {} }

// ── 나의 수첩 ──
// kind: memo(메모) | event(일정: date=YYYY-MM-DD, time="14:00" 선택) | anniv(기억할 날: month, day, lunar(true/false))
export async function listNotes() {
  if (!me) return [];
  const s = await getDocs(query(collection(db, 'notes'), where('uid', '==', me.uid)));
  return s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
export async function addNote(n) {
  if (!me) throw new Error('로그인이 필요합니다.');
  n.text = (n.text || '').trim(); if (!n.text) throw new Error('내용이 비어 있습니다.');
  const r = await addDoc(collection(db, 'notes'), { ...n, uid: me.uid, createdAt: Date.now() });
  return r.id;
}
export async function updateNote(id, n) { if (!me) throw new Error('로그인이 필요합니다.'); await updateDoc(doc(db, 'notes', id), { ...n, uid: me.uid, updatedAt: Date.now() }); }
export async function deleteNote(id) { await deleteDoc(doc(db, 'notes', id)); }

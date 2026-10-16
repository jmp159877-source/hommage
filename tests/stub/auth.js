const users={}; let cur=null; const cbs=[];
export function getAuth(){return {}}
export const browserLocalPersistence=1; export const setPersistence=async()=>{};
export function onAuthStateChanged(a,cb){cbs.push(cb);setTimeout(()=>cb(cur),10)}
const fire=()=>cbs.forEach(cb=>cb(cur));
export async function createUserWithEmailAndPassword(a,email,pw){if(users[email])throw {code:'auth/email-already-in-use'};users[email]={pw,uid:'u_'+email.split('@')[0]};cur={uid:users[email].uid,email};fire();return {user:cur}}
export async function signInWithEmailAndPassword(a,email,pw){if(!users[email]||users[email].pw!==pw)throw {code:'auth/invalid-credential'};cur={uid:users[email].uid,email};fire();return {user:cur}}
export async function signOut(){cur=null;fire()}
export async function updatePassword(u,pw){users[u.email].pw=pw}

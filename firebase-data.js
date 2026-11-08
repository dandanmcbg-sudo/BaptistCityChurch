
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
  initializeFirestore, memoryLocalCache, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, setDoc, deleteDoc, onSnapshot, getDocs,
  serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

const cfg = window.BCC_FIREBASE_CONFIG || {};
const configured = cfg.apiKey && !String(cfg.apiKey).includes("PASTE_") &&
                   cfg.projectId && !String(cfg.projectId).includes("PASTE_");

let db = null;
let unsubscribe = null;
let latest = [];
let source = "local";

function emit() {
  window.dispatchEvent(new CustomEvent("bcc-data", {detail:{records: latest, source}}));
}
function localRead(){
  try { return JSON.parse(localStorage.getItem("church_db") || "[]"); } catch { return []; }
}
function localWrite(records){
  localStorage.setItem("church_db", JSON.stringify(records));
}
export function isFirebaseConfigured(){ return configured; }

export async function startBCCData(){
  if (!configured) {
    latest = localRead(); source = "local";
    emit();
    return {mode:"local"};
  }

  const app = getApps().length ? getApp() : initializeApp(cfg);
  // The Invitation Center only reads recipients. Using memory cache here avoids
  // IndexedDB primary-lease contention with other open attendance/admin tabs.
  // Keep persistent offline caching unchanged on the main and admin pages.
  const invitationPage = /(?:^|\/)invitation\.html$/.test(location.pathname);
  db = initializeFirestore(app, {
    localCache: invitationPage
      ? memoryLocalCache()
      : persistentLocalCache({tabManager: persistentMultipleTabManager()})
  });

  // One-time migration of existing localStorage records into Firestore.
  const migrationKey = "bcc_firebase_migration_v1";
  if (document.body.classList.contains("admin-authorized") && !localStorage.getItem(migrationKey)) {
    const old = localRead();
    old.forEach(r => {
      if (!r.id) r.id = "id_" + Date.now() + "_" + Math.random().toString(36).slice(2,7);
      setDoc(doc(db,"members",r.id), {...r, updatedAt:serverTimestamp()}, {merge:true})
        .catch(console.error);
    });
    localStorage.setItem(migrationKey, "queued");
  }

  unsubscribe = onSnapshot(collection(db,"members"), {includeMetadataChanges:true}, snap => {
    latest = snap.docs.map(d => ({id:d.id, ...d.data()}));
    source = snap.metadata.fromCache ? "cache" : "cloud";
    localWrite(latest); // compatibility backup for existing UI + emergency fallback
    emit();
  }, err => {
    console.error("Firestore listener:", err);
    window.dispatchEvent(new CustomEvent("bcc-firestore-error", {detail:{code:err.code||"unknown",message:err.message||""}}));
    latest = localRead(); source = "local";
    emit();
  });
  return {mode:"firebase"};
}

export function getBCCRecords(){ return latest.length ? latest : localRead(); }

export async function upsertBCCRecord(record){
  if (!record.id) record.id = "id_" + Date.now() + "_" + Math.random().toString(36).slice(2,7);
  if (!configured) throw new Error("Firebase is not configured.");
  if (!db) throw new Error("Firebase connection is not ready. Refresh and sign in again.");
  // Wait for the server acknowledgement before reporting a successful save.
  await setDoc(doc(db,"members",record.id), {...record, updatedAt:serverTimestamp()}, {merge:true});
  return record.id;
}

export async function checkinBCCRecord(id, date){
  if (!configured || !db) throw new Error('Firebase connection is unavailable.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid attendance date.');
  // Atomic server-side transaction prevents two simultaneous check-ins overwriting each other.
  return runTransaction(db, async transaction => {
    const ref = doc(db, 'members', id);
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error('Attendee record was not found on Firebase.');
    const record = snap.data();
    if (record.lastAttended === date) throw new Error('Already checked in for this date.');
    transaction.update(ref, {
      totalAttendance: (Number(record.totalAttendance) || 0) + 1,
      lastAttended: date
    });
  });
}

export function removeBCCRecord(id){
  latest = getBCCRecords().filter(x => x.id !== id);
  localWrite(latest); emit();
  if (db) deleteDoc(doc(db,"members",id)).catch(console.error);
}

export function replaceBCCRecords(records){
  latest = records; localWrite(records); emit();
  if (db) records.forEach(r => upsertBCCRecord(r));
}

export function clearBCCRecords(){
  const ids = getBCCRecords().map(x => x.id);
  latest = []; localWrite([]); emit();
  if (db) ids.forEach(id => deleteDoc(doc(db,"members",id)).catch(console.error));
}

window.addEventListener("online", ()=>window.dispatchEvent(new Event("bcc-network")));
window.addEventListener("offline", ()=>window.dispatchEvent(new Event("bcc-network")));

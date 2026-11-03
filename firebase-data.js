
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
  initializeFirestore, memoryLocalCache, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, setDoc, deleteDoc, onSnapshot, getDocs,
  serverTimestamp
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

export function upsertBCCRecord(record){
  if (!record.id) record.id = "id_" + Date.now() + "_" + Math.random().toString(36).slice(2,7);
  // Immediate local mirror keeps UI responsive even before server ack.
  const arr = getBCCRecords().slice();
  const i = arr.findIndex(x => x.id === record.id);
  if (i >= 0) arr[i] = {...arr[i], ...record}; else arr.push(record);
  latest = arr; localWrite(arr); emit();

  if (db) {
    // Intentionally not awaited: offline writes are queued in Firestore persistent cache.
    setDoc(doc(db,"members",record.id), {...record, updatedAt:serverTimestamp()}, {merge:true})
      .catch(console.error);
  }
  return record.id;
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

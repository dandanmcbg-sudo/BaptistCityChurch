
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
  getFirestore,
  collection, doc, setDoc, deleteDoc, onSnapshot, getDocs,
  serverTimestamp, runTransaction, updateDoc, increment
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
  // Never destroy the last known populated backup with an empty or failed read.
  if (!Array.isArray(records) || records.length === 0) return;
  const previous = localRead();
  try {
    if (previous.length > 0) {
      const key = "bcc_backup_" + new Date().toISOString().slice(0,10);
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(previous));
    }
    localStorage.setItem("church_db", JSON.stringify(records));
  } catch (error) { console.warn("BCC local backup unavailable:", error); }
}
export function isFirebaseConfigured(){ return configured; }

export async function startBCCData(){
  if (!configured) {
    latest = localRead(); source = "local";
    emit();
    return {mode:"local"};
  }

  const app = getApps().length ? getApp() : initializeApp(cfg);
  // Reuse the Firestore instance initialized by the other page modules.
  // Calling initializeFirestore() after getFirestore() causes failed-precondition
  // and prevents the admin's existing member records from loading.
  db = getFirestore(app);

  // Automatic local-to-cloud migration disabled: requires explicit admin review to avoid overwriting live records.

  unsubscribe = onSnapshot(collection(db,"members"), {includeMetadataChanges:true}, snap => {
    const cloudRecords = snap.docs.map(d => ({id:d.id, ...d.data()}));
    // An empty snapshot must not silently erase or replace a populated local backup.
    if (cloudRecords.length === 0 && localRead().length > 0) {
      latest = localRead(); source = "recovery-local";
      window.dispatchEvent(new CustomEvent("bcc-firestore-error", {detail:{code:"empty-cloud",message:"No member records were returned. Displaying preserved local backup; cloud records need verification."}}));
      emit();
      return;
    }
    latest = cloudRecords;
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
  await updateDoc(doc(db, 'members', id), {
    totalAttendance: increment(1),
    lastAttended: date
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

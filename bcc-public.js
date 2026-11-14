import {initializeApp,getApps,getApp} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {getAuth,signInAnonymously,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import {getFirestore,collection,doc,getDocs,getDoc,setDoc,serverTimestamp,onSnapshot,query,where} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
const app=getApps().length?getApp():initializeApp(window.BCC_FIREBASE_CONFIG);
const db=getFirestore(app), auth=getAuth(app);
let signingIn;
let directory=[]; let directoryReady=null;
function listenDirectory(){
 if(!directoryReady) directoryReady=new Promise((resolve,reject)=>{
  let initial=true;onSnapshot(collection(db,"publicAttendees"),snap=>{
   directory=snap.docs.map(d=>({id:d.id,...d.data()}));
   if(initial){initial=false;resolve();}
  },err=>{if(initial){initial=false;reject(err);} console.error("Public directory sync:",err);});
 });
 return directoryReady;
}
async function ready(){
 if(auth.currentUser) return auth.currentUser;
 if(!signingIn) signingIn=new Promise((resolve,reject)=>{
  const unsub=onAuthStateChanged(auth,async user=>{
   if(user){unsub();resolve(user);return;}
   try{const credential=await signInAnonymously(auth);unsub();resolve(credential.user)}catch(e){unsub();reject(e)}
  },reject);
 });
 return signingIn;
}
window.BCCPublic={
 async search(query){await ready();await listenDirectory();
  const q=query.toLocaleLowerCase().trim();
  return {results:directory.filter(x=>x.name?.toLocaleLowerCase().includes(q)).slice(0,20)};
 },
 async checkin(memberId,date){const user=await ready();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Invalid date');
  const listing=await getDoc(doc(db,'publicAttendees',memberId));
  if(!listing.exists())throw Error('Attendee not in public directory. Ask admin to sync the directory.');
  // Confirmed check-in ledger: deterministic ID prevents a second create for this date.
  const id=memberId+'_'+date;
  try { await setDoc(doc(db,'attendanceCheckins',id),{memberId,date,requestedBy:user.uid,createdAt:serverTimestamp(),status:'confirmed'}); } catch(e) { if(e.code==='permission-denied'){const existing=await getDoc(doc(db,'attendanceCheckins',id)).catch(()=>null);if(existing?.exists())throw Error('Already checked in for this service.');}throw e; }
 },
 async register(person){await ready();
  const {id,...record}=person;
  await setDoc(doc(db,'members',id),{...record,id,updatedAt:serverTimestamp()});
 },
 async todayTotal(){await ready();const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const snap=await getDocs(query(collection(db,'attendanceCheckins'),where('date','==',date)));
  return {total:snap.size};
 }
};

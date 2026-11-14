import {initializeApp,getApps,getApp} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {getAuth,signInAnonymously,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import {getFirestore,collection,doc,getDocs,getDoc,setDoc,serverTimestamp} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
const app=getApps().length?getApp():initializeApp(window.BCC_FIREBASE_CONFIG);
const db=getFirestore(app), auth=getAuth(app);
let signingIn;
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
 async search(query){await ready();const snap=await getDocs(collection(db,'publicAttendees'));
  const q=query.toLocaleLowerCase().trim();
  return {results:snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.name?.toLocaleLowerCase().includes(q)).slice(0,20)};
 },
 async checkin(memberId,date){const user=await ready();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Invalid date');
  const listing=await getDoc(doc(db,'publicAttendees',memberId));
  if(!listing.exists())throw Error('Attendee not in public directory. Ask admin to sync the directory.');
  // One request per member per date. Only admin may approve and update totals.
  const id=memberId+'_'+date;
  await setDoc(doc(db,'attendanceCheckins',id),{memberId,date,requestedBy:user.uid,createdAt:serverTimestamp(),status:'pending'});
 },
 async register(person){await ready();
  const {id,...record}=person;
  await setDoc(doc(db,'members',id),{...record,id,updatedAt:serverTimestamp()});
 },
 async todayTotal(){await ready();const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const snap=await getDoc(doc(db,'publicStats','today'));
  const data=snap.data()||{};
  return {total:data.date===date?data.total:0};
 }
};

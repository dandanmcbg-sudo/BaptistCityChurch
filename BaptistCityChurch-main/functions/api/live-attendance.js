import {base,firestore,reply,sameOrigin} from './_firebase.js';
export async function onRequestGet({request,env}) {
  if(!sameOrigin(request)) return reply({error:'Invalid origin'},403);
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  try {
    const query={structuredQuery:{from:[{collectionId:'attendanceCheckins'}],where:{fieldFilter:{field:{fieldPath:'date'},op:'EQUAL',value:{stringValue:today}}},limit:3000}};
    const res=await firestore(env,base+':runQuery',{method:'POST',body:JSON.stringify(query)});
    if(!res.ok) throw new Error('Attendance count unavailable');
    const rows=await res.json();
    return reply({date:today,total:rows.filter(row=>row.document).length,updatedAt:new Date().toISOString()});
  }catch(e){console.error('live attendance',e);return reply({error:'Live count unavailable'},503);}
}

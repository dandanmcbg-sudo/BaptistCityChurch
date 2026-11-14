import {base,firestore,loadMembers,field,reply,str,int,sameOrigin} from './_firebase.js';
const text=(v,max=200)=>typeof v==='string'&&v.length<=max?v:'';
const today=()=>{const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const get=t=>parts.find(p=>p.type===t).value;return `${get('year')}-${get('month')}-${get('day')}`;};
function toField(v){if(typeof v==='boolean')return {booleanValue:v};if(Number.isInteger(v))return int(v);return str(v??'');}
export async function onRequestPost({request,env}){
 if(!sameOrigin(request))return reply({error:'Invalid origin'},403);
 if(Number(request.headers.get('Content-Length')||0)>12000)return reply({error:'Request too large'},413);
 let data;try{data=await request.json();}catch{return reply({error:'Invalid JSON'},400);}
 const name=text(data?.name,150).trim();
 if(!name)return reply({error:'Enter a valid attendee name'},400);
 if(!['Member','Visitor','Guest'].includes(data?.category))return reply({error:'Invalid category'},400);
 if(typeof data?.email!=='string'||data.email.length>254||typeof data?.prayerRequest!=='string'||data.prayerRequest.length>2000)return reply({error:'Invalid form fields'},400);
 try{
   const existing=await loadMembers(env);
   if(existing.some(d=>field(d,'name').trim().toLocaleLowerCase()===name.toLocaleLowerCase()))return reply({error:'This name already exists. Please use Sunday Check-in.'},409);
   const id='id_'+crypto.randomUUID().replace(/-/g,'');const date=today();
   const allowed=['name','category','email','contact','ministry','firstTimeVisitor','invitedBy','contactMethod','birthday','prayerRequest','reminderConsent','reminderEnabled','notes'];
   const fields={id:str(id),totalAttendance:int(1),lastAttended:str(date),updatedAt:{timestampValue:new Date().toISOString()}};
   for(const k of allowed){const v=data[k];if(typeof v==='string'&&v.length<= (k==='prayerRequest'?2000: k==='email'?254: k==='name'?150:500)||typeof v==='boolean')fields[k]=toField(v);}
   const memberName=base+'/members/'+id;
   const checkinName=base+'/attendanceCheckins/'+id+'_'+date;
   const commit=await firestore(env,base+':commit',{method:'POST',body:JSON.stringify({writes:[
     {update:{name:memberName,fields},currentDocument:{exists:false}},
     {update:{name:checkinName,fields:{memberId:str(id),date:str(date),createdAt:{timestampValue:new Date().toISOString()}}},currentDocument:{exists:false}}
   ]})});
   if(!commit.ok){console.error('Registration commit',commit.status,(await commit.text()).slice(0,300));return reply({error:'Unable to save registration. Please retry.'},503);}
   return reply({ok:true,id,name,date});
 }catch(e){console.error('Registration unavailable',e);return reply({error:'Secure registration service unavailable. Check Cloudflare configuration.'},503);}
}

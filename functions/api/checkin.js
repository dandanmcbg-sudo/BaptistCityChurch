import {base,firestore,loadMembers,field,idOf,reply,str,int,sameOrigin} from './_firebase.js';
export async function onRequestPost({request,env}){
  if(!sameOrigin(request))return reply({error:'Invalid origin'},403);
  if(Number(request.headers.get('Content-Length')||0)>2048)return reply({error:'Request too large'},413);
  let body;try{body=await request.json();}catch{return reply({error:'Invalid JSON'},400);}
  const {memberId,date}=body||{};
  if(typeof memberId!=='string'|| !/^[a-zA-Z0-9_-]{1,120}$/.test(memberId))return reply({error:'Invalid attendee'},400);
  // Public check-in is restricted to today's date in Manila to prevent arbitrary historical edits.
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if(date!==today)return reply({error:'Public check-in is available for today only'},400);
  try{
    const memberUrl=base+'/members/'+encodeURIComponent(memberId);
    const res=await firestore(env,memberUrl);
    if(res.status===404)return reply({error:'Attendee not found'},404);
    if(!res.ok)throw new Error('Cannot verify attendee');
    const member=await res.json();
    const old=Number(member.fields?.totalAttendance?.integerValue||0);
    const checkinName=`projects/baptistcitychurch-4491f/databases/(default)/documents/attendanceCheckins/${encodeURIComponent(memberId+'_'+date)}`;
    const writes=[
      {update:{name:checkinName,fields:{memberId:str(memberId),date:str(date),createdAt:{timestampValue:new Date().toISOString()}}},currentDocument:{exists:false}},
      {update:{name:member.name,fields:{totalAttendance:int(old+1),lastAttended:str(date)}},updateMask:{fieldPaths:['totalAttendance','lastAttended']},currentDocument:{updateTime:member.updateTime}}
    ];
    const commit=await firestore(env,base+':commit',{method:'POST',body:JSON.stringify({writes})});
    if(commit.ok)return reply({ok:true,name:field(member,'name'),date});
    const error=await commit.text();
    if(commit.status===409||commit.status===412||/ALREADY_EXISTS/.test(error))return reply({error:'Already checked in today, or the record was updated. Refresh and retry.'},409);
    console.error('Check-in commit failed',commit.status,error.slice(0,400));return reply({error:'Could not save check-in. Contact an administrator.'},503);
  }catch(e){console.error(e);return reply({error:'Check-in service unavailable'},503);}
}

import {loadMembers,field,idOf,reply,sameOrigin} from './_firebase.js';
export async function onRequestGet({request,env}){
  if(!sameOrigin(request))return reply({error:'Invalid origin'},403);
  const q=(new URL(request.url).searchParams.get('q')||'').trim().toLocaleLowerCase();
  if(q.length<1 || q.length>80)return reply({results:[]});
  try{
    const members=await loadMembers(env);
    const results=members.filter(d=>field(d,'name').toLocaleLowerCase().includes(q)).slice(0,12).map(d=>({id:idOf(d),name:field(d,'name'),category:field(d,'category')||'Attendee'}));
    return reply({results});
  }catch(e){console.error(e);return reply({error:'Attendee search unavailable'},503);}
}

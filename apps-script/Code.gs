/** Baptist City Church — backend-only Google Apps Script.
 * Deploy as Web app: Execute as Me, access Anyone.
 * Firebase ID tokens are verified server-side before any data access or email.
 * Cloudflare hosts all HTML. No Manager.html is required.
 */
const BCC = Object.freeze({
  projectId:'baptistcitychurch-4491f',
  apiKey:'AIzaSyBMFIhYLzGRP0SLmimUEMVJC1-30B27D_E',
  adminUid:'tSirLJ49mPTM2wo7kpmAxbqT7Rj2',
  timezone:'Asia/Manila', sheetProperty:'BCC_SHEET_ID', tab:'Attendees'
});

function setupBCCSheets(){
  const props=PropertiesService.getScriptProperties();
  let id=props.getProperty(BCC.sheetProperty);
  if(!id){const ss=SpreadsheetApp.create('Baptist City Church - Email Recipients');id=ss.getId();props.setProperty(BCC.sheetProperty,id)}
  const ss=SpreadsheetApp.openById(id);
  const sh=ss.getSheetByName(BCC.tab)||ss.insertSheet(BCC.tab);
  if(sh.getLastRow()===0)sh.appendRow(['ID','Name','Email','Category','Email Consent','Reminder Enabled','Updated At']);
  Logger.log('Google Sheet: '+ss.getUrl());
  return ss.getUrl();
}
function sheet_(){
  const id=PropertiesService.getScriptProperties().getProperty(BCC.sheetProperty);
  if(!id)throw Error('Run setupBCCSheets() first.');
  const sh=SpreadsheetApp.openById(id).getSheetByName(BCC.tab);
  if(!sh)throw Error('Attendees tab missing.');
  return sh;
}
function verify_(token){
  if(typeof token!=='string'||!token.trim())throw Error('Please sign in as the church administrator.');
  const url='https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(BCC.apiKey);
  const response=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',payload:JSON.stringify({idToken:token}),muteHttpExceptions:true});
  if(response.getResponseCode()!==200)throw Error('Admin authentication expired or invalid. Sign in again.');
  const user=(JSON.parse(response.getContentText()).users||[])[0];
  if(!user||user.localId!==BCC.adminUid)throw Error('This account is not an authorized administrator.');
  return user;
}
function emailValid_(s){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s||''))}
function escape_(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function safeText_(s,max){return String(s==null?'':s).trim().slice(0,max)}
function read_(){
  return sheet_().getDataRange().getValues().slice(1)
    .filter(r=>emailValid_(r[2])&&(r[4]===true||String(r[4]).toLowerCase()==='true')&&r[5]!==false&&String(r[5]).toLowerCase()!=='false')
    .map(r=>({id:String(r[0]),name:String(r[1]),email:String(r[2]),category:String(r[3])}));
}
function sync_(records){
  if(!Array.isArray(records)||records.length>500)throw Error('Maximum 500 records per batch.');
  const sh=sheet_(),values=sh.getDataRange().getValues();
  const index=new Map(values.slice(1).map((r,i)=>[String(r[2]).trim().toLowerCase(),i+2]));
  let updated=0,created=0,skipped=0;
  records.forEach(a=>{
    const email=safeText_(a.email,254).toLowerCase();
    if(!emailValid_(email)){skipped++;return}
    // Do not treat reminderEnabled alone as consent.
    const consent=a.reminderConsent===true;
    const row=[safeText_(a.id,150),safeText_(a.name,150),email,safeText_(a.category,40),consent,a.reminderEnabled!==false,new Date()];
    const existing=index.get(email);
    if(existing){sh.getRange(existing,1,1,7).setValues([row]);updated++}
    else{sh.appendRow(row);index.set(email,sh.getLastRow());created++}
  });
  return {ok:true,created,updated,skipped};
}
function email_(person,event){
  const x=escape_;
  const rsvp=String(event.rsvp||'');
  const link=/^https:\/\/[^\s<>"']+$/i.test(rsvp)?'<p><a href="'+x(rsvp)+'">Event details / RSVP</a></p>':'';
  return '<div style="font-family:Arial,sans-serif;background:#f4efe7;padding:24px"><div style="max-width:580px;margin:auto;background:#fffdfa;padding:28px;border-radius:14px"><h1>Baptist City Church</h1><h2>You’re Invited!</h2><p>Hello '+x(person.name||'Friend')+',</p><p>'+x(event.message||'We would love to see you!')+'</p><p><strong>'+x(event.name)+'</strong></p><p>'+x(event.date)+' · '+x(event.time||'')+'</p><p>'+x(event.venue||'Baptist City Church')+'</p>'+link+'<blockquote>“I was glad when they said unto me, Let us go into the house of the LORD.” — Psalm 122:1 (KJV)</blockquote><p>With love,<br>Baptist City Church</p></div></div>';
}
function send_(data){
  const e=data.event||{};
  const event={name:safeText_(e.name,120),date:safeText_(e.date,40),time:safeText_(e.time,40),venue:safeText_(e.venue,150),message:safeText_(e.message,2000),rsvp:safeText_(e.rsvp,500)};
  if(!event.name||!event.date)throw Error('Event name and date required.');
  const ids=Array.isArray(data.recipientIds)?[...new Set(data.recipientIds.map(String))]:[];
  if(ids.length<1||ids.length>100)throw Error('Select 1–100 recipients.');
  const requestId=safeText_(data.requestId,80);
  if(!/^[a-zA-Z0-9_-]{8,80}$/.test(requestId))throw Error('Valid unique requestId required.');
  const allowed=new Map(read_().map(p=>[p.id,p]));
  const chosen=ids.map(id=>allowed.get(id)).filter(Boolean);
  if(!chosen.length)throw Error('No opted-in recipients found in Google Sheets.');
  if(MailApp.getRemainingDailyQuota()<chosen.length)throw Error('Insufficient email quota today.');
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{
    const props=PropertiesService.getScriptProperties(),key='BCC_SENT_'+requestId;
    if(props.getProperty(key))return {ok:false,message:'Request already started. Check Sent folder and execution logs before retrying.'};
    // Reserve before sending: prevents duplicates after a timeout; may require manual reconciliation on partial failure.
    props.setProperty(key,JSON.stringify({status:'started',at:new Date().toISOString()}));
  }finally{lock.releaseLock()}
  let sent=0,failed=0;
  chosen.forEach(p=>{
    try{MailApp.sendEmail({to:p.email,subject:'You’re Invited — '+event.name,body:'You are invited to '+event.name+' at Baptist City Church.',htmlBody:email_(p,event),name:'Baptist City Church'});sent++}
    catch(err){failed++;console.error('Mail delivery failed: '+err.message)}
  });
  PropertiesService.getScriptProperties().setProperty('BCC_SENT_'+requestId,JSON.stringify({status:'finished',sent,failed,at:new Date().toISOString()}));
  return {ok:failed===0,sent,failed,message:'Accepted by MailApp: '+sent+'; failed: '+failed};
}
function api_(action,data,token){
  verify_(token);
  if(action==='list')return {ok:true,recipients:read_()};
  if(action==='sync')return sync_(data.records||[]);
  if(action==='send')return send_(data);
  if(action==='test'){
    const to=safeText_(data.email,254);
    if(!emailValid_(to))throw Error('Valid test email required.');
    const requestId=safeText_(data.requestId,80);
    if(!/^[a-zA-Z0-9_-]{8,80}$/.test(requestId))throw Error('Valid unique requestId required.');
    const props=PropertiesService.getScriptProperties(),key='BCC_TEST_'+requestId;
    const lock=LockService.getScriptLock();lock.waitLock(15000);
    try{if(props.getProperty(key))return {ok:false,message:'Test already submitted.'};props.setProperty(key,new Date().toISOString())}finally{lock.releaseLock()}
    MailApp.sendEmail({to,subject:'BCC Invitation Email Test',body:'Baptist City Church email backend test.',htmlBody:email_({name:'Friend'},{name:'Sunday Worship',date:'Upcoming Sunday',venue:'Baptist City Church',message:'This is a test invitation.'}),name:'Baptist City Church'});
    return {ok:true,message:'Test accepted by MailApp.'};
  }
  throw Error('Unsupported action.');
}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)}
function doGet(){return json_({ok:true,service:'BCC Invitation Backend',htmlManager:false})}
function doPost(e){
  try{
    if(!e||!e.postData||!e.postData.contents)throw Error('Missing POST body.');
    const request=JSON.parse(e.postData.contents);
    const result=api_(String(request.action||''),request.data||{},request.token);
    console.log("BCC action " + String(request.action||"unknown") + " result: " + JSON.stringify(result));
    return json_(result);
  }catch(err){
    console.error('BCC API failure: '+(err&&err.stack||err));
    return json_({ok:false,message:String(err&&err.message||'Unknown server error')});
  }
}
// Editor-run diagnostic only: does not require Firebase auth or send emails.
function checkBCCBackend(){
  const sh=sheet_();
  Logger.log('Backend ready. Attendees sheet: '+sh.getParent().getUrl()+'; rows: '+Math.max(0,sh.getLastRow()-1));
}

/** Baptist City Church — Google Sheets invitation manager.
 * Run setupBCCSheets() once; deploy as Web App: Execute as Me, Access Anyone.
 * All sensitive calls require a Firebase ID token verified server-side.
 * Website attendance/Firebase records remain unchanged.
 */
const BCC = {
  projectId: 'baptistcitychurch-4491f',
  apiKey: 'AIzaSyBMFIhYLzGRP0SLmimUEMVJC1-30B27D_E',
  adminUid: 'tSirLJ49mPTM2wo7kpmAxbqT7Rj2',
  timezone: 'Asia/Manila',
  sheetProperty: 'BCC_SHEET_ID',
  tab: 'Attendees'
};
function setupBCCSheets() {
  const props=PropertiesService.getScriptProperties();
  let id=props.getProperty(BCC.sheetProperty);
  if(!id){const ss=SpreadsheetApp.create('Baptist City Church - Email Recipients');id=ss.getId();props.setProperty(BCC.sheetProperty,id)}
  const ss=SpreadsheetApp.openById(id);
  let sh=ss.getSheetByName(BCC.tab)||ss.insertSheet(BCC.tab);
  if(sh.getLastRow()===0)sh.appendRow(['ID','Name','Email','Category','Email Consent','Reminder Enabled','Updated At']);
  Logger.log('Google Sheet: '+ss.getUrl());
  return ss.getUrl();
}
function sheet_(){const id=PropertiesService.getScriptProperties().getProperty(BCC.sheetProperty);if(!id)throw Error('Run setupBCCSheets() first.');return SpreadsheetApp.openById(id).getSheetByName(BCC.tab)}
function verify_(token){
  if(!token||typeof token!=='string')throw Error('Please sign in as the church administrator.');
  // Firebase Identity Toolkit verifies the ID token signature, expiry and Firebase project.
  const url='https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(BCC.apiKey);
  const r=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',payload:JSON.stringify({idToken:token}),muteHttpExceptions:true});
  if(r.getResponseCode()!==200)throw Error('Admin authentication expired or invalid.');
  const user=(JSON.parse(r.getContentText()).users||[])[0];
  if(!user||user.localId!==BCC.adminUid)throw Error('This account is not an authorized administrator.');
  return user;
}
function api_(action,data,token){
  verify_(token);
  if(action==='list')return {ok:true,recipients:read_()};
  if(action==='sync')return sync_(data.records||[]);
  if(action==='send')return send_(data);
  throw Error('Unsupported action');
}
function read_(){
  const values=sheet_().getDataRange().getValues();
  return values.slice(1).filter(r=>r[2]&&r[4]===true).map(r=>({id:String(r[0]),name:String(r[1]),email:String(r[2]),category:String(r[3])}));
}
function sync_(records){
  if(!Array.isArray(records)||records.length>500)throw Error('Maximum 500 records per batch.');
  const sh=sheet_(),values=sh.getDataRange().getValues();
  const index=new Map(values.slice(1).map((r,i)=>[String(r[2]).toLowerCase(),i+2]));
  let updated=0,created=0;
  records.forEach(a=>{
    const email=String(a.email||'').trim().toLowerCase();
    if(!emailValid_(email))return;
    const consent=a.reminderConsent===true;
    const row=[String(a.id||''),String(a.name||'').slice(0,150),email,String(a.category||''),consent,a.reminderEnabled!==false,new Date()];
    const existing=index.get(email);
    if(existing){sh.getRange(existing,1,1,7).setValues([row]);updated++}
    else{sh.appendRow(row);index.set(email,sh.getLastRow());created++}
  });
  return {ok:true,created,updated};
}
function send_(data){
  const event=data.event||{}, requested=Array.isArray(data.recipientIds)?data.recipientIds:[];
  const eventName=String(event.name||'').trim().slice(0,120);
  if(!eventName||!event.date)throw Error('Event name and date required.');
  if(!requested.length||requested.length>100)throw Error('Select 1–100 recipients.');
  const requestId=String(data.requestId||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80);
  if(!requestId)throw Error('Request ID required.');
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{
    const props=PropertiesService.getScriptProperties(),key='BCC_SENT_'+requestId;
    if(props.getProperty(key))return {ok:false,message:'This request was already processed. Check the Sent folder.'};
    props.setProperty(key,new Date().toISOString());
  }finally{lock.releaseLock()}
  const allowed=new Map(read_().map(x=>[x.id,x]));
  const chosen=[...new Set(requested.map(String))].map(id=>allowed.get(id)).filter(Boolean);
  if(!chosen.length)throw Error('No opted-in recipients found in Google Sheets.');
  if(MailApp.getRemainingDailyQuota()<chosen.length)throw Error('Insufficient email quota today.');
  let sent=0,failed=0;
  chosen.forEach(person=>{
    try{
      MailApp.sendEmail({to:person.email,subject:'You’re Invited — '+eventName,body:'You are invited to '+eventName+' at Baptist City Church.',htmlBody:email_(person,event),name:'Baptist City Church'});
      sent++;
    }catch(e){failed++;console.error('Delivery failed to '+person.email+': '+e.message)}
  });
  return {ok:true,sent,failed,message:'Sent: '+sent+'; failed: '+failed};
}
function email_(p,e){
  const x=escape_;const link=/^https:\/\//.test(String(e.rsvp||''))?'<p><a href="'+x(e.rsvp)+'">Event details / RSVP</a></p>':'';
  return '<div style="font-family:Arial,sans-serif;background:#f4efe7;padding:24px"><div style="max-width:580px;margin:auto;background:white;padding:28px;border-radius:14px"><h1>Baptist City Church</h1><h2>You’re Invited!</h2><p>Hello '+x(p.name||'Friend')+',</p><p>'+x(e.message||'We would love to see you!')+'</p><p><strong>'+x(e.name)+'</strong></p><p>'+x(e.date)+' · '+x(e.time||'')+'</p><p>'+x(e.venue||'Baptist City Church')+'</p>'+link+'<blockquote>“I was glad when they said unto me, Let us go into the house of the LORD.” — Psalm 122:1 (KJV)</blockquote><p>With love,<br>Baptist City Church</p></div></div>';
}
function escape_(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function emailValid_(s){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)}
function doGet(){return ContentService.createTextOutput(JSON.stringify({ok:true,service:'BCC Invitation Backend'})).setMimeType(ContentService.MimeType.JSON)}
// Website-only interface: Apps Script serves a JSON backend, never HTML.
function doPost(e){
  try {
    const body=JSON.parse((e&&e.postData&&e.postData.contents)||'{}');
    const action=String(body.action||'');
    let result;
    if(action==='syncAttendees') result=api_('sync',{records:body.records||[]},body.idToken);
    else if(action==='sendInvitations') {
      verify_(body.idToken);
      const requested=Array.isArray(body.recipientIds)?body.recipientIds:[];
      result=send_({event:body.event||{},recipientIds:requested,requestId:body.requestId});
    } else if(action==='testEmail') {
      verify_(body.idToken);
      const address=String(body.email||'').trim();
      if(!emailValid_(address))throw Error('Valid test email required.');
      MailApp.sendEmail({to:address,subject:'BCC Email Test',body:'Baptist City Church email backend is working.',name:'Baptist City Church'});
      result={ok:true,message:'Test email submitted to MailApp.'};
    } else throw Error('Unsupported action.');
    return json_(result);
  }catch(err){console.error(err);return json_({ok:false,message:String(err.message||err)})}
}
function json_(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON)}

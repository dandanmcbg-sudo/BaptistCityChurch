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
function bccEmailDate_(value){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));
  if(!m)return String(value||'');
  const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]);
  const dt=new Date(Date.UTC(y,mo-1,d));
  if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==mo-1||dt.getUTCDate()!==d)return String(value||'');
  return Utilities.formatDate(dt,'UTC','MMMM d, yyyy');
}
function bccEmailTime_(value){
  const m=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value||''));
  if(!m)return String(value||'');
  const h=Number(m[1]);
  return (h%12||12)+':'+m[2]+' '+(h<12?'AM':'PM');
}
function email_(person,event){
  // Email-safe tables and inline styles mirror invitation.html's Email Preview.
  const x=escape_;
  const name=x(person.name||'Guest');
  const title=x(event.name||'Upcoming Church Event');
  const message=x(event.message||'We would love to have you join us.').replace(/\r?\n/g,'<br>');
  const date=x(bccEmailDate_(event.date)||'Event date');
  const time=x(bccEmailTime_(event.time)||'Event time');
  const venue=x(event.venue||'Baptist City Church');
  const rsvp=String(event.rsvp||'').trim();
  const link=/^https:\/\/[^\s<>"']+$/i.test(rsvp)
    ? '<p style="margin:18px 0 0"><a href="'+x(rsvp)+'" style="background:#171717;color:#ffffff;padding:11px 18px;border-radius:9px;text-decoration:none;font-weight:bold;display:inline-block">RSVP / Event Details</a></p>' : '';
  // A publicly accessible logo is required for images in Gmail. No private Firebase URL.
  const logo='https://baptistcitychurch.pages.dev/assets/bcc-logo.png';
  return '<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'+
    '<body style="margin:0;padding:0;background:#f2eee7;font-family:Arial,Helvetica,sans-serif;color:#171717">'+
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f2eee7"><tr><td align="center" style="padding:18px 12px">'+
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:620px;background:#ffffff;border:1px solid #e7ddd0;border-radius:14px;overflow:hidden">'+
    '<tr><td align="center" style="background:#171717;color:#ffffff;padding:24px 16px">'+
    '<img src="'+logo+'" alt="Baptist City Church" width="56" height="56" style="display:block;border:0;border-radius:12px;width:56px;height:56px;object-fit:cover;margin:0 auto 12px">'+
    '<div style="font-size:18px;font-weight:700;line-height:1.35">You&#39;re Invited</div><div style="font-size:14px;line-height:1.5">Baptist City Church</div></td></tr>'+
    '<tr><td style="padding:26px 24px 28px">'+
    '<div style="font-size:13px;color:#6e6259">Dear <strong>'+name+'</strong>,</div>'+
    '<h2 style="font-size:20px;margin:7px 0 15px;line-height:1.3;color:#171717">'+title+'</h2>'+
    '<p style="font-size:15px;line-height:1.65;margin:0 0 17px">'+message+'</p>'+
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f7f2ea;border-radius:12px"><tr><td style="padding:16px;font-size:14px;line-height:1.6">'+
    '&#128197; <strong>Date:</strong> '+date+'<br>&#128336; <strong>Time:</strong> '+time+'<br>&#128205; <strong>Location:</strong> '+venue+'</td></tr></table>'+link+
    '<p style="font-size:13px;color:#786b60;line-height:1.5;margin:23px 0 0">With love,<br>Baptist City Church</p>'+
    '</td></tr></table></td></tr></table></body></html>';
}

function send_(data){
  const e=data.event||{};
  const event={name:safeText_(e.name,120),date:safeText_(e.date,40),time:safeText_(e.time,40),venue:safeText_(e.venue,150),message:safeText_(e.message,2000),rsvp:safeText_(e.rsvp,500)};
  if(!event.name||!event.date)throw Error('Event name and date required.');
  const ids=Array.isArray(data.recipientIds)?[...new Set(data.recipientIds.map(String))]:[];
  if(ids.length<1||ids.length>100)throw Error('Select 1–100 recipients.');
  const requestId=safeText_(data.requestId,80);
  if(!/^[a-zA-Z0-9_-]{8,80}$/.test(requestId))throw Error('Valid unique requestId required.');
  // Sync selected, explicitly consenting Firebase attendees before lookup.
  // This prevents a background-sync race or an empty Sheet from blocking sending.
  // api_() has already verified the Firebase admin ID token.
  if(Array.isArray(data.records)){
    if(data.records.length>100)throw Error('Too many recipient records.');
    const selectedIds=new Set(ids);
    const safeRecords=data.records.filter(r=>r && selectedIds.has(String(r.id)) && r.reminderConsent===true);
    sync_(safeRecords);
    SpreadsheetApp.flush();
  }
  const allowed=new Map(read_().map(p=>[p.id,p]));
  const chosen=ids.map(id=>allowed.get(id)).filter(Boolean);
  if(!chosen.length)throw Error('No opted-in recipients found in Google Sheets.');
  console.log('BCC invitation: opted-in recipients=' + chosen.length);
  if(MailApp.getRemainingDailyQuota()<chosen.length)throw Error('Insufficient email quota today.');
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{
    const props=PropertiesService.getScriptProperties(),key='BCC_SENT_'+requestId;
    if(props.getProperty(key))return {ok:false,message:'Request already started. Check Sent folder and execution logs before retrying.'};
    // Reserve before sending: prevents duplicates after a timeout; may require manual reconciliation on partial failure.
    props.setProperty(key,JSON.stringify({status:'started',at:new Date().toISOString()}));
    props.setProperty('BCC_RESULT_'+requestId,JSON.stringify({status:'processing',kind:'send',at:new Date().toISOString()}));
  }finally{lock.releaseLock()}
  let sent=0,failed=0;
  chosen.forEach(p=>{
    try{MailApp.sendEmail({to:p.email,subject:'You’re Invited — '+event.name,body:'You are invited to '+event.name+' at Baptist City Church.',htmlBody:email_(p,event),name:'Baptist City Church'});sent++}
    catch(err){failed++;console.error('Mail delivery failed: '+err.message)}
  });
  PropertiesService.getScriptProperties().setProperty('BCC_SENT_'+requestId,JSON.stringify({status:'finished',sent,failed,at:new Date().toISOString()}));
  PropertiesService.getScriptProperties().setProperty('BCC_RESULT_'+requestId,JSON.stringify({status:failed?'partial':'accepted',kind:'send',sent,failed,at:new Date().toISOString()}));
  console.log('BCC invitation batch result: accepted=' + sent + ', failed=' + failed);
  return {ok:failed===0,sent,failed,message:'Accepted by MailApp: '+sent+'; failed: '+failed};
}
function api_(action,data,token){
  console.log('BCC request received: action=' + action);
  verify_(token);
  console.log('BCC admin verified: action=' + action);
  if(action==='list')return {ok:true,recipients:read_()};
  if(action==='sync')return sync_(data.records||[]);
  if(action==='send')return send_(data);
  if(action==='automationStatus'){
    const requestId=safeText_(data.requestId,80);
    if(!/^[a-zA-Z0-9_-]{8,80}$/.test(requestId))throw Error('Invalid request ID.');
    const props=PropertiesService.getScriptProperties();
    const recent=JSON.parse(props.getProperty('BCC_AUTO_HISTORY')||'[]');
    const active=ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='sendSaturdayInvitation');
    const result={ok:true,active,timezone:'Asia/Manila',schedule:'Saturday approximately 8:00 AM',history:recent.slice(0,30),quota:MailApp.getRemainingDailyQuota()};
    props.setProperty('BCC_RESULT_'+requestId,JSON.stringify({status:'accepted',kind:'automationStatus',...result}));
    return result;
  }
  if(action==='test'){
    const to=safeText_(data.email,254);
    if(!emailValid_(to))throw Error('Valid test email required.');
    const requestId=safeText_(data.requestId,80);
    if(!/^[a-zA-Z0-9_-]{8,80}$/.test(requestId))throw Error('Valid unique requestId required.');
    const props=PropertiesService.getScriptProperties(),key='BCC_TEST_'+requestId;
    const lock=LockService.getScriptLock();lock.waitLock(15000);
    try{if(props.getProperty(key))return {ok:false,message:'Test already submitted.'};props.setProperty(key,new Date().toISOString())}finally{lock.releaseLock()}
    const e=data.event||{};
    const testEvent={name:safeText_(e.name,120)||'Upcoming Church Event',date:safeText_(e.date,40)||'Event date',time:safeText_(e.time,40)||'Event time',venue:safeText_(e.venue,150)||'Baptist City Church',message:safeText_(e.message,2000)||'We would love to have you join us.',rsvp:safeText_(e.rsvp,500)};
    props.setProperty('BCC_RESULT_'+requestId,JSON.stringify({status:'processing',kind:'test',at:new Date().toISOString()}));
    console.log('BCC test email: attempting MailApp send to ' + to);
    MailApp.sendEmail({to,subject:'[TEST] You’re Invited — '+testEvent.name,body:'Baptist City Church invitation preview: '+testEvent.name+' | '+testEvent.date+' | '+testEvent.venue,htmlBody:email_({name:'Guest'},testEvent),name:'Baptist City Church'});
    props.setProperty('BCC_RESULT_'+requestId,JSON.stringify({status:'accepted',kind:'test',sent:1,failed:0,at:new Date().toISOString()}));
    console.log('BCC test email: MailApp accepted delivery request to ' + to);
    return {ok:true,message:'Test accepted by MailApp.'};
  }
  throw Error('Unsupported action.');
}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)}
// Status endpoint returns only non-personal delivery counts. Random request IDs are unguessable.
// JSONP is needed because Apps Script ContentService does not provide CORS headers.
function doGet(e){
  const q=(e&&e.parameter)||{};
  if(q.action!=='status')return json_({ok:true,service:'BCC Invitation Backend',htmlManager:false});
  const id=String(q.id||'');
  const callback=String(q.callback||'');
  if(!/^[a-zA-Z0-9_-]{8,80}$/.test(id)||!/^BCCstatus_[a-zA-Z0-9_]{8,80}$/.test(callback))return json_({ok:false,message:'Invalid status query'});
  const raw=PropertiesService.getScriptProperties().getProperty('BCC_RESULT_'+id);
  const result=raw?JSON.parse(raw):{status:'unknown'};
  return ContentService.createTextOutput(callback+'('+JSON.stringify(result)+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}
function doPost(e){
  let requestId='';
  try{
    if(!e||!e.postData||!e.postData.contents)throw Error('Missing POST body.');
    const request=JSON.parse(e.postData.contents);
    requestId=String(request.data&&request.data.requestId||'');
    const result=api_(String(request.action||''),request.data||{},request.token);
    console.log("BCC action " + String(request.action||"unknown") + " result: " + JSON.stringify(result));
    return json_(result);
  }catch(err){
    console.error('BCC API failure: '+(err&&err.stack||err));
    if(/^[a-zA-Z0-9_-]{8,80}$/.test(requestId))PropertiesService.getScriptProperties().setProperty('BCC_RESULT_'+requestId,JSON.stringify({status:'failed',message:String(err&&err.message||'Unknown server error').slice(0,220),at:new Date().toISOString()}));
    return json_({ok:false,message:String(err&&err.message||'Unknown server error')});
  }
}
// Editor-run diagnostic only: does not require Firebase auth or send emails.
function checkBCCBackend(){
  const sh=sheet_();
  Logger.log('Backend ready. Attendees sheet: '+sh.getParent().getUrl()+'; rows: '+Math.max(0,sh.getLastRow()-1));
}

// Run this from the Apps Script editor ONLY to verify MailApp independently.
// It sends one actual HTML invitation to the church's designated test inbox.
function testBCCEmailDelivery(){
  const recipient='dandanmcbg@gmail.com';
  const event={name:'Baptist City Church — Test Invitation',date:'Test event date',time:'Test event time',venue:'Baptist City Church',message:'Greetings from Baptist City Church! This is an HTML email delivery test.',rsvp:''};
  MailApp.sendEmail({to:recipient,subject:'[TEST] You’re Invited — '+event.name,body:'Baptist City Church HTML invitation test.',htmlBody:email_({name:'Guest'},event),name:'Baptist City Church'});
  Logger.log('MailApp accepted one HTML test email to '+recipient);
}

/** AUTOMATIC INVITATION CENTER — separate from manual Send Invitation.
 * One-time setup: run setupSaturdayInvitationTrigger() in Apps Script.
 * Schedule: Saturday ~8 AM Asia/Manila; event: following Sunday.
 * Source: Google Sheets Attendees, with explicit consent + reminders enabled.
 * IMPORTANT: Keep Sheets synced from Firebase before Saturday.
 */
const BCC_AUTO_INVITATION = Object.freeze({
  eventName:'Sunday Worship Service',
  eventTime:'09:00', // Change to the church's confirmed Sunday service time.
  venue:'Baptist City Church',
  message:'You are warmly invited to worship with us this Sunday. We look forward to seeing you!\n\n“I was glad when they said unto me, Let us go into the house of the LORD.” — Psalm 122:1 (KJV)'
});
function setupSaturdayInvitationTrigger(){
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='sendSaturdayInvitation')
    .forEach(t=>ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendSaturdayInvitation').timeBased().onWeekDay(ScriptApp.WeekDay.SATURDAY)
    .atHour(8).nearMinute(0).everyWeeks(1).inTimezone('Asia/Manila').create();
  console.log('Saturday invitation trigger installed (approximately 8 AM, Asia/Manila).');
}
function sendSaturdayInvitation(){
  const now=new Date();
  const day=Utilities.formatDate(now,'Asia/Manila','u'); // 1=Mon, 6=Sat
  if(day!=='6')return {ok:false,message:'Skipped: not Saturday in Philippine time.'};
  const today=Utilities.formatDate(now,'Asia/Manila','yyyy-MM-dd');
  const sunday=new Date(Date.UTC(Number(today.slice(0,4)),Number(today.slice(5,7))-1,Number(today.slice(8,10))+1));
  const date=Utilities.formatDate(sunday,'UTC','yyyy-MM-dd');
  const event={name:BCC_AUTO_INVITATION.eventName,date:date,time:BCC_AUTO_INVITATION.eventTime,
    venue:BCC_AUTO_INVITATION.venue,message:BCC_AUTO_INVITATION.message,rsvp:''};
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const props=PropertiesService.getScriptProperties();
    const key='BCC_AUTO_INVITATION_'+today;
    const recipients=[...new Map(read_().map(p=>[p.email.trim().toLowerCase(),p])).values()];
    if(!recipients.length){bccAutoLog_({date:today,eventDate:date,sent:0,failed:0,already:0,status:'no-recipients'});return {ok:false,message:'No opted-in recipients in Google Sheets; nothing sent.'};}
    const remaining=MailApp.getRemainingDailyQuota();
    if(remaining<recipients.length){bccAutoLog_({date:today,eventDate:date,sent:0,failed:0,already:0,status:'quota-insufficient'});return {ok:false,message:'Insufficient MailApp quota; nothing sent.'};}
    let sent=0,failed=0,already=0;
    recipients.forEach(p=>{
      const recipientKey=key+'_'+Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,p.email.toLowerCase())).slice(0,30);
      if(props.getProperty(recipientKey)){already++;return}
      // Reserve before sending to avoid duplicate messages on trigger retries.
      props.setProperty(recipientKey,'started:'+new Date().toISOString());
      try{
        MailApp.sendEmail({to:p.email,subject:'You’re Invited — '+event.name,
          body:'You are invited to '+event.name+' on '+bccEmailDate_(event.date)+' at '+bccEmailTime_(event.time)+'.',
          htmlBody:email_(p,event),name:'Baptist City Church'});
        props.setProperty(recipientKey,'accepted:'+new Date().toISOString());sent++;
      }catch(err){failed++;console.error('Saturday invitation delivery error: '+err.message)}
    });
    bccAutoLog_({date:today,eventDate:date,sent,failed,already,status:failed?'partial':'accepted'});
    console.log(JSON.stringify({date:today,eventDate:date,sent,failed,already}));
    return {ok:failed===0,sent,failed,already,eventDate:date};
  }finally{lock.releaseLock()}
}

// Aggregate only. Do not store member names or addresses in dashboard history.
function bccAutoLog_(entry){
  const props=PropertiesService.getScriptProperties();
  const history=JSON.parse(props.getProperty('BCC_AUTO_HISTORY')||'[]');
  history.unshift({...entry,executedAt:new Date().toISOString()});
  props.setProperty('BCC_AUTO_HISTORY',JSON.stringify(history.slice(0,40)));
}

/**
 * Baptist City Church — Attendance Reminder Backend
 *
 * SETUP:
 * 1) Apps Script > Project Settings > Time zone = Asia/Manila
 * 2) Run setupSundayReminderTrigger() ONCE and authorize.
 * 3) The trigger runs every Saturday around 8:00 AM PH time.
 *
 * DATA SOURCE:
 * The website sends attendee data to this Apps Script using action: "syncAttendee".
 * Email addresses are stored in Apps Script Properties (server side).
 */

const CHURCH_NAME = 'Baptist City Church';
const TZ = 'Asia/Manila';
const ATTENDEE_KEY = 'BCC_ATTENDEES_V1';
const FIREBASE_API_KEY = 'AIzaSyBMFIhYLzGRP0SLmimUEMVJC1-30B27D_E';
const ADMIN_UID = 'tSirLJ49mPTM2wo7kpmAxbqT7Rj2';

function doGet() {
  return json_({ok:true, service:'BCC Attendance Reminder Backend'});
}

function doPost(e) {
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    if (data.action === 'syncAttendee') {
      return json_(syncAttendee_(data.attendee || {}));
    }

    if (data.action === 'sendInvitations') {
      return json_(sendInvitations_(data));
    }

    return json_({ok:false, message:'Unknown action.'});
  } catch (err) {
    return json_({ok:false, message:String(err && err.message || err)});
  }
}

/* ---------- ATTENDEE STORAGE ---------- */

function getAttendees_() {
  const raw = PropertiesService.getScriptProperties().getProperty(ATTENDEE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveAttendees_(rows) {
  PropertiesService.getScriptProperties()
    .setProperty(ATTENDEE_KEY, JSON.stringify(rows));
}

function syncAttendee_(a) {
  const email = String(a.email || '').trim().toLowerCase();
  if (!email || !isEmail_(email)) {
    return {ok:false, message:'A valid attendee email is required.'};
  }

  const rows = getAttendees_();
  const now = new Date().toISOString();
  const i = rows.findIndex(x => String(x.email || '').toLowerCase() === email);

  const record = {
    id: a.id || (i >= 0 ? rows[i].id : Utilities.getUuid()),
    name: String(a.name || (i >= 0 ? rows[i].name : '')).trim(),
    email: email,
    category: String(a.category || (i >= 0 ? rows[i].category : '')).trim(),
    contact: String(a.contact || (i >= 0 ? rows[i].contact : '')).trim(),
    lastAttended: a.lastAttended || (i >= 0 ? rows[i].lastAttended : ''),
    reminderEnabled: a.reminderEnabled !== false,
    updatedAt: now
  };

  if (i >= 0) rows[i] = Object.assign({}, rows[i], record);
  else rows.push(record);

  saveAttendees_(rows);
  return {ok:true, message:'Attendee synced to reminder backend.'};
}

/* ---------- AUTOMATIC SUNDAY REMINDER ---------- */

function setupSundayReminderTrigger() {
  // Avoid duplicate reminder triggers.
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'runSundayReminder') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Saturday 8 AM Manila time. Apps Script time triggers run within the hour.
  ScriptApp.newTrigger('runSundayReminder')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SATURDAY)
    .atHour(8)
    .inTimezone(TZ)
    .create();

  return 'Saturday reminder trigger created.';
}

function runSundayReminder() {
  const now = new Date();

  // Safety guard: only send on Saturday in Manila.
  if (Utilities.formatDate(now, TZ, 'u') !== '6') return;

  const attendees = getAttendees_()
    .filter(a => a.reminderEnabled !== false && isEmail_(a.email));

  let sent = 0, failed = 0;

  attendees.forEach(a => {
    try {
      const firstName = String(a.name || 'Friend').trim().split(/\s+/)[0];
      const subject = 'See you tomorrow at Baptist City Church';
      const html = buildSundayReminderHtml_(firstName);

      MailApp.sendEmail({
        to: a.email,
        subject: subject,
        htmlBody: html,
        name: CHURCH_NAME
      });
      sent++;
    } catch (err) {
      failed++;
      console.error('Reminder failed for ' + a.email, err);
    }
  });

  console.log('BCC Sunday reminders — sent: ' + sent + ', failed: ' + failed);
}

function buildSundayReminderHtml_(name) {
  return `
  <div style="margin:0;background:#f4efe7;padding:30px 12px;font-family:Arial,sans-serif;color:#171717">
    <div style="max-width:600px;margin:auto;background:#fffdfa;border-radius:16px;overflow:hidden;border:1px solid #e7ddd0">
      <div style="background:#171717;color:white;text-align:center;padding:28px">
        <div style="font-size:12px;letter-spacing:2px">${CHURCH_NAME.toUpperCase()}</div>
        <h1 style="margin:10px 0 0;font-size:26px">Sunday Reminder</h1>
      </div>
      <div style="padding:30px;line-height:1.7">
        <p>Hello ${escapeHtml_(name)},</p>
        <p>Just a friendly reminder that tomorrow is Sunday. We would love to see you at <b>${CHURCH_NAME}</b>.</p>
        <div style="background:#f5efe6;border-radius:12px;padding:18px;margin:20px 0">
          Don’t forget to join us tomorrow for worship and fellowship.
        </div>
        <p>See you at church! God bless you.</p>
        <p>With love,<br><b>${CHURCH_NAME}</b></p>
      </div>
    </div>
  </div>`;
}

/* ---------- EXISTING EVENT INVITATION SUPPORT ---------- */

function verifyInvitationAdmin_(idToken) {
  if (!idToken || typeof idToken !== 'string') throw new Error('Missing Firebase admin sign-in token.');
  const endpoint = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(FIREBASE_API_KEY);
  const response = UrlFetchApp.fetch(endpoint, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify({idToken:idToken}), muteHttpExceptions:true
  });
  if (response.getResponseCode() !== 200) throw new Error('Admin login expired or token rejected. Sign in again.');
  const result = JSON.parse(response.getContentText());
  const account = (result.users || [])[0];
  if (!account || account.localId !== ADMIN_UID || account.disabled) throw new Error('Not an authorized Baptist City Church administrator.');
  return account.localId;
}

function sendInvitations_(data) {
  verifyInvitationAdmin_(data.idToken);
  const event = data.event || {};
  const recipients = Array.isArray(data.recipients) ? data.recipients : [];
  const requestId = String(data.requestId || '');
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)) throw new Error('Missing valid invitation request ID.');
  if (!String(event.name || '').trim() || !String(event.date || '').trim())
    throw new Error('Event name and date are required.');
  if (!recipients.length || recipients.length > 100) throw new Error('Select between 1 and 100 recipients per batch.');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Another invitation batch is processing. Try again later.');
  try {
    const cache = CacheService.getScriptCache();
    const cacheKey = 'BCC_INV_' + requestId;
    if (cache.get(cacheKey)) return {ok:false, message:'Duplicate batch blocked. Check previous delivery in Executions.'};
    cache.put(cacheKey, 'processing', 21600);
    const unique = {};
    const list = recipients.filter(r => {
      const email = String(r.email || '').trim().toLowerCase();
      if (!isEmail_(email) || unique[email]) return false;
      unique[email] = true;
      return true;
    });
    if (MailApp.getRemainingDailyQuota() < list.length) {
      cache.remove(cacheKey);
      throw new Error('Gmail daily recipient quota is insufficient for this batch.');
    }
    let sent = 0, failed = 0;
    const failures = [];
    list.forEach(r => {
      try {
        const t = HtmlService.createTemplateFromFile('Invitation');
        t.personName = String(r.name || 'Friend').slice(0,150);
        t.eventName = String(event.name).slice(0,150);
        t.eventDate = String(event.date || '').slice(0,30);
        t.eventTime = String(event.time || '').slice(0,30);
        t.venue = String(event.venue || CHURCH_NAME).slice(0,200);
        t.message = String(event.message || 'We would love to have you join us.').slice(0,3000);
        t.rsvp = /^https:\/\//.test(String(event.rsvp || '')) ? event.rsvp : '';
        MailApp.sendEmail({
          to:String(r.email).trim(),
          subject:'You’re Invited — ' + String(event.name).slice(0,150),
          body:'Baptist City Church invites you to ' + event.name + ' on ' + event.date + '. ' + (event.venue || CHURCH_NAME),
          htmlBody:t.evaluate().getContent(),
          name:CHURCH_NAME
        });
        sent++;
      } catch(err) {
        failed++;
        failures.push(String(r.email || '') + ': ' + String(err.message || err));
      }
    });
    Logger.log(JSON.stringify({action:'sendInvitations',requestId,sent,failed,failures}));
    return {ok:failed===0, sent, failed, message:'Sent: '+sent+', Failed: '+failed};
  } finally { lock.releaseLock(); }
}

/* ---------- HELPERS ---------- */

function isEmail_(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
}
function escapeHtml_(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

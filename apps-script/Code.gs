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

function sendInvitations_(data) {
  const event = data.event || {};
  const recipients = Array.isArray(data.recipients) ? data.recipients : [];
  if (!event.name || !recipients.length)
    return {ok:false,message:'Event and recipients are required.'};

  let sent = 0, failed = 0;
  recipients.forEach(r => {
    try {
      if (!isEmail_(r.email)) throw new Error('Invalid email');
      const t = HtmlService.createTemplateFromFile('Invitation');
      t.personName = r.name || 'Friend';
      t.eventName = event.name || 'Baptist City Church Event';
      t.eventDate = event.date || '';
      t.eventTime = event.time || '';
      t.venue = event.venue || CHURCH_NAME;
      t.message = event.message || 'We would love to have you join us.';
      t.rsvp = event.rsvp || '';
      MailApp.sendEmail({
        to:r.email,
        subject:'You’re Invited — ' + event.name,
        htmlBody:t.evaluate().getContent(),
        name:CHURCH_NAME
      });
      sent++;
    } catch(err) { failed++; }
  });
  return {ok:true,sent:sent,failed:failed,message:`Sent: ${sent}, Failed: ${failed}`};
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

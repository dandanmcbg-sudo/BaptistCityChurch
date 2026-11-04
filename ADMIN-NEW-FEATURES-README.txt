BCC Admin v5 — Email Automation Center and Church Events Calendar

1. Upload website files to Cloudflare Pages (including automation.html and events.html).
2. Publish updated firestore.rules in Firebase Console -> Firestore Database -> Rules. This grants only the existing admin UID access to churchEvents.
3. Replace Apps Script Code.gs with apps-script/Code.gs. Deploy -> Manage deployments -> Edit -> New version -> Deploy. Keep existing Apps Script Web App URL or update bcc_apps_script_url in browser if changed.
4. Run setupSaturdayInvitationTrigger() ONCE in Apps Script and authorize. Check Triggers. Saturday approximately 8 AM Asia/Manila, not guaranteed exactly 8:00:00.
5. In Admin -> Email Automation Center, Refresh Status to check trigger and historical runs. Safe Test Email sends only to one entered address, not the entire opted-in list. Test is a mail delivery test, not a simulated Saturday scheduled run.
6. In Admin -> Church Events Calendar, add/edit/delete events in Firestore; Use in Invitation Center pre-fills the invitation form. It never sends automatically.

Historical automation runs only begin being recorded after this backend version is deployed. Status counts indicate MailApp acceptance, not inbox delivery. Existing members and attendance data are not migrated or deleted. Saturday automation still depends on Google Sheets opted-in recipients and quotas.

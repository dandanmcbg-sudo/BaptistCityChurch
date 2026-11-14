BCC v37 AUTOMATIC CHECK-IN (staged)
- No admin approval; attendanceCheckins documents are confirmed immediately on successful Firebase save.
- Main page success popups for check-in and registration.
- Admin page live list of confirmed check-ins.
- Existing members collection and private member data are preserved.
- IMPORTANT: Existing members.totalAttendance/lastAttended are NOT incremented automatically by anonymous users. The authoritative attendanceCheckins ledger is separate. An authenticated backend is required for secure aggregation into members.
- Public name directory still requires admin sync and explicit consent; existing members are NOT automatically exposed.
- Publish firestore.rules and test with a staging Cloudflare deployment before production.
- No live Firebase testing has been performed.

# BCC Admin/Main Sync v34

Baseline: supplied BCC-FULL-REVISED-WEBSITE(1).zip, preserved in original root structure.

## Changes
- Removed Admin `save()` bulk re-upload of every member (stale attendance overwrite risk).
- Disabled automatic browser-to-Firestore migration that could overwrite existing members.
- Disabled automatic first-attendance backfill that could fabricate historic attendance.
- Disabled bulk delete in admin to protect production data.
- Kept the existing Firestore onSnapshot listener in admin: member changes from the public backend update admin automatically.
- Kept existing `/api/attendees`, `/api/checkin`, `/api/register`, `/api/live-attendance` functions and public UI.

## Required deployment
- Deploy with Wrangler (`npx wrangler pages deploy . --project-name=baptistcitychurch`), not dashboard drag/drop, so Pages Functions are included.
- Configure FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY as encrypted Cloudflare Pages secrets.
- Deploy Firestore rules separately only after reviewing current production rules.
- Do not upload Firebase service account keys to ZIP, GitHub, or browser.

## Verify before Sunday service
1. Back up Firestore `members` and `attendanceCheckins` first.
2. Sign in to admin and confirm existing members appear.
3. Search a member on public page; check-in once.
4. Confirm member `lastAttended` and `totalAttendance` change in admin without refreshing.
5. Confirm duplicate check-in does not increment count.
6. Test on a second device and verify `/api/live-attendance` responds.

Caveat: Public live counter polls, so not instantaneous. Existing attendance data is not changed by preparing this ZIP. Live deployment and Firebase credentials cannot be verified offline.

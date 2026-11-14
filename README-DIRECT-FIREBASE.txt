BCC DIRECT FIREBASE - SAFE STAGED RELEASE

1. BACK UP existing Firestore rules and export Firestore data first.
2. Publish firestore.rules from this ZIP in Firebase Console > Firestore > Rules.
3. Upload ZIP to Cloudflare Pages (top-level files).
4. Open admin.html, log in with the existing admin account, and click "Sync public name directory". This publishes ONLY name/category. Do this only with consent from the people listed.
5. Test search and check-in with a test attendee. Check-in creates PENDING requests; it does NOT mark a member present automatically or change their totalAttendance. An admin must verify and process them.
6. Existing Admin, Invitation, and historical records are retained. PublicStats total will show zero until a separate verified admin tally process is implemented.

IMPORTANT: This is a safe staged implementation, NOT a fully automated attendance release. Anonymous users can impersonate a name; do not automatically approve requests. Public registration remains open to spam and needs additional anti-abuse controls. The directory currently lists names and categories to anyone who can anonymously sign in; obtain consent before syncing.

To avoid unexpected stale files, this ZIP contains only the root deployable site, not nested old site copies.

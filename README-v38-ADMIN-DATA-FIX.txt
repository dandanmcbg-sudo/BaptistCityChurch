BCC v38 ADMIN DATA CONNECTION FIX

Fixed conflicting Firestore initialization that could stop admin members loading.
Added a visible Firebase read error notice rather than silently showing zero records.
No Firestore rules, records, or member data are modified by this patch.
Deploy the ZIP contents, sign in with the admin Firebase account, and verify the member counts and directory.
Do not click Clear All Records.
Public directory sync still requires consent and does not automatically publish private member names.
Automatic check-in totals in members are not implemented; this release does not claim to fix them.

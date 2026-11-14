BCC Admin v6 — Sunday Church Service Statistics

Added statistics-style Email Automation Center with purple metric cards, donut charts, recorded-run totals, and Saturday Sunday Worship scripture (Psalm 122:1 KJV) in the scheduled email.

Numbers come from the existing Apps Script BCC_AUTO_HISTORY (up to 40 recent runs), not invented delivery/open/click/spam data. MailApp acceptance does not prove delivery. Contacts count unavailable without a dedicated backend count endpoint.

Deploy website files to Cloudflare Pages. Replace Apps Script Code.gs and redeploy web app. Existing Saturday trigger should remain installed; check Triggers. No changes to Firebase data or Firestore rules.

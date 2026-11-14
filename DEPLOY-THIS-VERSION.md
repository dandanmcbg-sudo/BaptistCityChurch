# Baptist City Church — consolidated release

This package contains the current public check-in UI, success popups, name search, live attendance polling, and Cloudflare Pages Functions. It does NOT contain Firebase member data; existing records stay in Firestore.

## Deployment
1. Back up Firestore first. Do not delete the members collection or reset the database.
2. In Cloudflare Pages project settings, add encrypted secrets FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY from a Firebase service account. Do not place the private key in client-side files or share it in chat.
3. Install Node.js, open a terminal in THIS directory (the one containing index.html and functions/), run `npx wrangler login`, then `npx wrangler pages deploy . --project-name=baptistcitychurch`. The project name must match the existing Cloudflare Pages project. Plain ZIP/drag-drop uploads do not deploy the functions/ source directory.
4. Confirm GET /api/attendees?q=ma returns JSON and /api/live-attendance responds. A 503 indicates backend secrets or service-account permissions are not configured.
5. Test with a test attendee only: check-in once, confirm count, try again to verify no duplicate, and check a second device.

## Security and limitations
Public search reveals matching names and categories, and public check-in can be performed by anyone who knows a name. Before real-world deployment, add rate limiting, abuse protection, and an attendee verification method (e.g. per-attendee PIN or QR). This version polls for live attendance; it is not an instant push listener. Existing Firestore rules should continue to block unauthenticated direct writes to members. Backend writes use server credentials. Public registration uses the existing browser-side flow and rules and may require separate verification. No live deployment or Firebase test has been performed here.

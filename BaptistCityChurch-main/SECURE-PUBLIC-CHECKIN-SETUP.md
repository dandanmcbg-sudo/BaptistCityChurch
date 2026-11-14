# BCC secure public check-in setup

1. Deploy the **contents of this folder** to Cloudflare Pages using a Git-connected deployment (Pages Functions require a supported Functions deployment, not a static drag-and-drop upload). The `functions/api/` directory must be at the deployment root.
2. Cloudflare Pages > Settings > Variables and Secrets: add encrypted secrets `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` from a Firebase service account with the minimum required Firestore permissions. Never put the private key in browser JS, Git, or a public ZIP. Use the service-account private key with literal newlines or escaped `\n`.
3. Keep existing Firestore rules restricting `/members` to admin reads/updates. The service account uses server credentials and is not subject to client Firestore rules.
4. Test `/api/attendees?q=am` and public check-in on the deployed domain; confirm duplicate submissions are blocked and private member fields are absent from responses.
5. IMPORTANT: This is a baseline public workflow, **not abuse-resistant**. Anyone can submit a check-in for any name they can find, and public search reveals member names/categories. Before public launch, add Cloudflare Turnstile verified server-side, rate limiting, and preferably an attendee-specific PIN/QR or staff confirmation. Do not advertise this as verified attendance without identity verification.
6. Public check-in accepts **today in Asia/Manila only**. Historic corrections belong to authenticated admin workflow.
7. This package has not been deployed or end-to-end tested against live Firebase credentials.

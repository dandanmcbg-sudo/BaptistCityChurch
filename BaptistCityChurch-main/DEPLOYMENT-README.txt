Baptist City Church - Website Email Status Fix

Changes: website test email now sends live event fields and checks Apps Script MailApp acceptance through read-only request status. Backend Code.gs exposes no recipient details in status and logs server errors.

Deploy: (1) Update Code.gs in existing Apps Script and deploy a NEW VERSION of the same deployment. (2) Upload website root files to Cloudflare Pages. (3) Sign in as Firebase admin and send ONE test. Check the on-screen Accepted/Failed status and Gmail inbox.

Note: MailApp accepted is not proof of Gmail inbox delivery. Existing Firebase/Sheets data is not deleted. No live requests were made during local syntax tests.

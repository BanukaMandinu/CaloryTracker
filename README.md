# BM Calory Tracker

Static PWA (`public/`) plus one Cloudflare Pages Function (`functions/api/[[route]].js`) for Google sign-in and cloud sync. It runs on the Cloudflare free tier with no AI or API fees. Barcode scanning is on-device, and food data comes from Open Food Facts (free, no key).

## One-time setup

1. **Google OAuth client** (Google Cloud Console → APIs & Services → Credentials → *OAuth client ID* → *Web application*)
   - Authorised JavaScript origins: `https://<your-project>.pages.dev` (and your custom domain), plus `http://localhost:8788` for local testing.
   - Copy the Client ID into `wrangler.toml` (`GOOGLE_CLIENT_ID`). It is public, not a secret.
   - Configure the OAuth consent screen (External; add yourself as a test user while in testing mode).
2. **KV namespace**: `npx wrangler kv namespace create DATA`. Paste the returned id into `wrangler.toml`.
3. **Session secret**: generate a long random string, then `npx wrangler pages secret put SESSION_SECRET`.
4. **Deploy**: `npx wrangler pages deploy` (or connect the repo in the Cloudflare dashboard, build output dir `public`, and add the KV binding `DATA`, the `GOOGLE_CLIENT_ID` variable and the `SESSION_SECRET` secret in Pages → Settings).

## Local test
```
echo SESSION_SECRET=dev-secret-change-me > .dev.vars
npx wrangler pages dev
```
Without the setup above the app still works fully in guest mode (data in the browser only).

## Security notes
- Google ID tokens are verified server-side (RS256 signature, `aud`, `iss`, `exp`), and the session is an HMAC-signed `HttpOnly; Secure; SameSite=Lax` cookie (30 days).
- Each user can only read or write their own KV key, which is derived from the verified session. Writes are validated and capped at 1 MB. State-changing calls check the `Origin` header.
- Audit lines (login, logout, data write and delete, with a hashed user id and no PII) go to Workers Logs.
- Recommended: add a Cloudflare rate-limiting rule on `/api/*`.
- Health-related personal data can fall under GDPR and similar laws if you serve other people. Have qualified legal or compliance counsel validate the privacy policy, consent and retention before opening it beyond personal use. A delete-my-data endpoint is already included (Settings → Erase all data).

## Notifications and reminders

Two kinds, both free:

- **In-app dialogs and messages.** Confirmations (sign out, delete, leave a workout...) are styled in-app dialogs, not the browser's plain popups.
- **Push reminders** (log breakfast / lunch / dinner, water, workout, evening check-in). The Worker runs a cron every 15 minutes (`[triggers]` in `wrangler.toml`), works out which reminders are due in each person's own time zone, and sends them as encrypted web push messages (VAPID + RFC 8291). They arrive even when the app is closed. A reminder is skipped when you have already done the thing (meal logged, water goal nearly met, workout done, rest day).
  - Turn them on in **Profile → Reminders** (one switch per device; phone and laptop are independent). **Send a test** checks the whole chain.
  - **iPhone / iPad:** reminders only work after *Share → Add to Home Screen*, then opening the app from the Home Screen.
  - **Keys:** if `VAPID_PRIVATE_JWK` (secret) and `VAPID_PUBLIC_KEY` (variable) are not set, a key pair is generated once and stored in KV, so nothing needs configuring. To manage the keys yourself, generate a P-256 key pair, put the private JWK in the `VAPID_PRIVATE_JWK` secret and the base64url public key (65-byte uncompressed point) in `VAPID_PUBLIC_KEY`. Moving the private key into a Cloudflare secret is the recommended hardening step.
  - **Privacy and security:** the push payload is encrypted end to end to the user's browser and contains only generic text. To skip reminders that are already done, the scheduler reads the user's own diary from KV, never anyone else's. Only real push-service hosts (FCM, Mozilla, Apple, Windows) are ever contacted, a subscription is limited to 5 devices per account, and "Erase all data" also deletes the reminder record. Dead devices are removed automatically.
  - If the data is health-related and you serve other people, have qualified legal or compliance counsel validate the consent and retention wording (GDPR and similar rules).

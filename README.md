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

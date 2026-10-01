// Cloudflare Pages Function: Google sign-in + per-user data sync.
// Bindings needed: DATA (KV namespace), GOOGLE_CLIENT_ID (var), SESSION_SECRET (secret).
// Design: least privilege (a user can only touch their own key), input validation, size limits,
// audit log lines (hashed user id, no PII) via console.log -> Workers Logs.

const SESSION_DAYS = 30;
const MAX_BODY = 1_000_000; // bytes
const enc = new TextEncoder();

const b64u = {
  enc: buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
};
const json = (obj, status = 200, headers = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });

async function hmacKey(secret, usage) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, usage);
}
async function sign(payload, secret) {
  const body = b64u.enc(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret, ['sign']), enc.encode(body));
  return `${body}.${b64u.enc(sig)}`;
}
async function readSession(request, env) {
  const m = /(?:^|;\s*)bmct_session=([^;]+)/.exec(request.headers.get('cookie') || '');
  if (!m || !env.SESSION_SECRET) return null;
  const [body, sig] = m[1].split('.');
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(env.SESSION_SECRET, ['verify']), b64u.dec(sig), enc.encode(body));
    if (!ok) return null;
    const p = JSON.parse(new TextDecoder().decode(b64u.dec(body)));
    return p.exp > Date.now() / 1000 && /^\d{5,30}$/.test(p.sub) ? p : null;
  } catch { return null; }
}
const cookie = (value, maxAge) => `bmct_session=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

async function auditId(sub) { // short hash so logs never hold the raw Google id
  const h = await crypto.subtle.digest('SHA-256', enc.encode(sub));
  return b64u.enc(h).slice(0, 10);
}
async function audit(event, sub) { console.log(JSON.stringify({ t: new Date().toISOString(), event, user: await auditId(sub) })); }

// Verify a Google ID token (RS256) against Google's published keys.
async function verifyGoogleToken(idToken, clientId) {
  const parts = String(idToken).split('.');
  if (parts.length !== 3) throw new Error('malformed');
  const header = JSON.parse(new TextDecoder().decode(b64u.dec(parts[0])));
  const claims = JSON.parse(new TextDecoder().decode(b64u.dec(parts[1])));
  if (header.alg !== 'RS256') throw new Error('alg');
  const jwks = await (await fetch('https://www.googleapis.com/oauth2/v3/certs', { cf: { cacheTtl: 3600, cacheEverything: true } })).json();
  const jwk = jwks.keys.find(k => k.kid === header.kid);
  if (!jwk) throw new Error('kid');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u.dec(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
  const now = Date.now() / 1000;
  if (!valid || claims.aud !== clientId || !['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss)
    || claims.exp < now || claims.iat > now + 300 || !claims.sub) throw new Error('claims');
  return claims;
}

// Stable, non-reversible account id for the client (never the raw Google sub).
const uidOf = async sub => [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode('uid:' + sub)))].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');

export async function onRequest({ request, env, params }) {
  const route = [].concat(params.route || []).join('/');
  const method = request.method;

  if (route === 'config' && method === 'GET') return json({ clientId: env.GOOGLE_CLIENT_ID || null });

  // Model file proxy: Safari cannot follow Hugging Face's cross-origin redirects, so we fetch server-side and serve same-origin.
  // Locked to one public model repo, GET only, so it cannot be used as an open proxy.
  if (route.startsWith('hf/') && (method === 'GET' || method === 'HEAD')) {
    const path = route.slice(3), allowed = 'Xenova/clip-vit-base-patch32/resolve/main/';
    if (!path.startsWith(allowed) || path.includes('..') || path.length > 200) return json({ error: 'not found' }, 404);
    try {
      const up = await fetch('https://huggingface.co/' + path, { redirect: 'follow', headers: { 'user-agent': 'BMCaloryTracker/1.0' }, cf: { cacheEverything: true, cacheTtl: 604800 } });
      if (!up.ok) return json({ error: 'upstream ' + up.status }, up.status === 404 ? 404 : 502);
      const h = new Headers({ 'content-type': up.headers.get('content-type') || 'application/octet-stream', 'cache-control': 'public, max-age=604800' });
      const len = up.headers.get('content-length'); if (len) h.set('content-length', len);
      return new Response(method === 'HEAD' ? null : up.body, { status: 200, headers: h });
    } catch { return json({ error: 'upstream unavailable' }, 502); }
  }

  // Food search proxy (Open Food Facts blocks browser CORS on its fast search endpoint). Public, read-only, cached.
  if (route === 'foods' && method === 'GET') {
    const sp = new URL(request.url).searchParams, lk = sp.get('lk') === '1';
    const q = (sp.get('q') || '').trim().slice(0, 60).replace(/["\\]/g, '');
    if (q.length < 2) return json({ products: [] });
    try {
      const r = await fetch(`https://search.openfoodfacts.org/search?q=${encodeURIComponent(lk ? q + ' countries_tags:"en:sri-lanka"' : q)}&page_size=30&fields=product_name,brands,nutriments,serving_quantity,product_quantity,countries_tags`,
        { headers: { 'user-agent': 'BMCaloryTracker/1.0 (personal app)' }, cf: { cacheTtl: 3600, cacheEverything: true } });
      if (!r.ok) throw new Error('upstream');
      const j = await r.json();
      return json({ products: (j.hits || []).slice(0, 30) }, 200, { 'cache-control': 'public, max-age=3600' });
    } catch { return json({ products: [] }, 502); }
  }

  // CSRF defence in depth: state-changing calls must come from our own origin.
  if (method !== 'GET') {
    const origin = request.headers.get('origin');
    if (!origin || origin !== new URL(request.url).origin) return json({ error: 'bad origin' }, 403);
  }
  if (!env.DATA || !env.SESSION_SECRET || !env.GOOGLE_CLIENT_ID) return json({ error: 'server not configured' }, 503);

  if (route === 'auth/google' && method === 'POST') {
    try {
      const { credential } = await request.json();
      const c = await verifyGoogleToken(credential, env.GOOGLE_CLIENT_ID);
      if (c.email_verified === false) return json({ error: 'email not verified' }, 403);
      const user = { sub: c.sub, name: String(c.name || '').slice(0, 80), email: String(c.email || '').slice(0, 120), picture: String(c.picture || '') };
      await env.DATA.put(`profile:${c.sub}`, JSON.stringify({ name: user.name, email: user.email }));
      const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
      await audit('login', c.sub);
      return json({ user: { uid: await uidOf(c.sub), name: user.name, email: user.email, picture: user.picture } }, 200,
        { 'set-cookie': cookie(await sign({ sub: c.sub, name: user.name, email: user.email, picture: user.picture, exp }, env.SESSION_SECRET), SESSION_DAYS * 86400) });
    } catch { return json({ error: 'invalid credential' }, 401); }
  }

  if (route === 'auth/logout' && method === 'POST') {
    const s = await readSession(request, env); if (s) await audit('logout', s.sub);
    return json({ ok: true }, 200, { 'set-cookie': cookie('', 0) });
  }

  const session = await readSession(request, env);
  if (route === 'me' && method === 'GET') return session ? json({ user: { uid: await uidOf(session.sub), name: session.name, email: session.email, picture: session.picture } }) : json({ user: null });
  if (!session) return json({ error: 'unauthenticated' }, 401);

  if (route === 'data') {
    const key = `data:${session.sub}`; // key derives only from the verified session
    if (method === 'GET') {
      const v = await env.DATA.get(key);
      return json({ db: v ? JSON.parse(v) : null });
    }
    if (method === 'PUT') {
      const text = await request.text();
      if (text.length > MAX_BODY) return json({ error: 'too large' }, 413);
      let db; try { db = JSON.parse(text); } catch { return json({ error: 'bad json' }, 400); }
      if (!db || typeof db !== 'object' || Array.isArray(db) || typeof db.days !== 'object' || typeof db.settings !== 'object' || typeof db.weights !== 'object')
        return json({ error: 'bad shape' }, 400);
      // isolation: the copy must be stamped with THIS account's id, so one account's diary can never be saved into another's
      if (db.owner !== await uidOf(session.sub)) return json({ error: 'owner mismatch' }, 409);
      await env.DATA.put(key, text);
      await audit('data_write', session.sub);
      return json({ ok: true });
    }
    if (method === 'DELETE') { // right to erasure
      await env.DATA.delete(key); await env.DATA.delete(`profile:${session.sub}`);
      await audit('data_delete', session.sub);
      return json({ ok: true });
    }
  }
  return json({ error: 'not found' }, 404);
}

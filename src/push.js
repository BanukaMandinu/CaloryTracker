// Web Push for BM Calory Tracker: VAPID signing, RFC 8291 (aes128gcm) payload encryption, and the reminder scheduler.
// Runs on Cloudflare Workers (WebCrypto + fetch only). Reminder content is generic; nothing personal is sent to push services
// except the encrypted payload, which only the user's own browser can decrypt.

const enc = new TextEncoder();
const b64u = {
  enc: buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: s => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
};
const concat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };

// ---------- VAPID keys ----------
// Prefer real secrets (VAPID_PRIVATE_JWK + VAPID_PUBLIC_KEY). If they are not set, a key pair is generated once and kept in KV so push works with zero setup.
let keyCache = null;
export async function vapidKeys(env) {
  if (env.VAPID_PRIVATE_JWK && env.VAPID_PUBLIC_KEY) return { privateJwk: JSON.parse(env.VAPID_PRIVATE_JWK), publicKey: env.VAPID_PUBLIC_KEY };
  if (keyCache) return keyCache;
  let rec = await env.DATA.get('vapid:keys');
  if (!rec) {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    await env.DATA.put('vapid:keys', JSON.stringify({ privateJwk: await crypto.subtle.exportKey('jwk', kp.privateKey), publicKey: b64u.enc(await crypto.subtle.exportKey('raw', kp.publicKey)) }));
    rec = await env.DATA.get('vapid:keys'); // re-read so concurrent first requests all agree on the stored pair
  }
  return (keyCache = JSON.parse(rec));
}
async function vapidHeader(endpoint, keys, subject) {
  const h = b64u.enc(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const c = b64u.enc(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey('jwk', keys.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${h}.${c}`));
  return `vapid t=${h}.${c}.${b64u.enc(sig)}, k=${keys.publicKey}`;
}

// ---------- payload encryption (RFC 8291 / RFC 8188, aes128gcm) ----------
async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}
export async function encryptPayload(sub, payload) {
  const ua = b64u.dec(sub.keys.p256dh), auth = b64u.dec(sub.keys.auth);
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, eph.privateKey, 256));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const ikm = await hkdf(auth, secret, concat(enc.encode('WebPush: info\0'), ua, asPub), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const body = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, concat(payload, new Uint8Array([2])))); // 0x02 = last record
  return concat(salt, new Uint8Array([0, 0, 0x10, 0]), new Uint8Array([asPub.length]), asPub, body);
}

// Only real browser push services are ever contacted, so a crafted subscription cannot be used to make the server call arbitrary URLs.
export function allowedEndpoint(u) {
  try {
    const x = new URL(u); if (x.protocol !== 'https:' || x.username || x.password || x.port) return false;
    return x.hostname === 'fcm.googleapis.com' || x.hostname === 'updates.push.services.mozilla.com' || x.hostname.endsWith('.push.services.mozilla.com')
      || x.hostname.endsWith('.push.apple.com') || /^[a-z0-9-]+\.notify\.windows\.com$/.test(x.hostname);
  } catch { return false; }
}
export const validSub = s => !!s && typeof s === 'object' && typeof s.endpoint === 'string' && s.endpoint.length < 600 && allowedEndpoint(s.endpoint)
  && typeof s.keys?.p256dh === 'string' && typeof s.keys?.auth === 'string' && s.keys.p256dh.length < 200 && s.keys.auth.length < 100;

export async function sendPush(sub, message, keys, subject, ttl = 3600) {
  const body = await encryptPayload(sub, enc.encode(JSON.stringify(message)));
  const r = await fetch(sub.endpoint, { method: 'POST', body, headers: { 'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream', ttl: String(ttl), urgency: 'normal', authorization: await vapidHeader(sub.endpoint, keys, subject) } });
  return r.status; // 201 delivered to the push service; 404 / 410 mean the subscription is gone
}

// ---------- preferences ----------
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export function sanitizePrefs(p) {
  p = p && typeof p === 'object' ? p : {};
  const it = p.items && typeof p.items === 'object' ? p.items : {}, t = (v, d) => TIME.test(String(v)) ? String(v) : d, one = (k, d) => ({ on: it[k]?.on === true, time: t(it[k]?.time, d) });
  return { on: p.on !== false, items: { breakfast: one('breakfast', '08:00'), lunch: one('lunch', '13:00'), dinner: one('dinner', '19:30'),
    water: { on: it.water?.on === true, every: [2, 3, 4].includes(+it.water?.every) ? +it.water.every : 3 }, workout: one('workout', '17:30'), evening: one('evening', '21:00') } };
}
export const validTz = tz => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return typeof tz === 'string' && tz.length < 60; } catch { return false; } };

// ---------- scheduler ----------
const WDN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], WINDOW = 30; // a reminder is due for 30 minutes after its time (cron runs every 15)
export function localParts(d, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' }).formatToParts(d).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: (+p.hour % 24) * 60 + +p.minute, wd: WDN.indexOf(p.weekday) };
}
const mins = hhmm => +hhmm.slice(0, 2) * 60 + +hhmm.slice(3);
export function dueReminders(prefs, lp, sent = {}) {
  const out = [], it = prefs.items, due = (id, time) => { const t = mins(time); return lp.minutes >= t && lp.minutes < t + WINDOW && sent[`${id}@${time}`] !== lp.date ? { id, time, key: `${id}@${time}` } : null; };
  for (const id of ['breakfast', 'lunch', 'dinner', 'workout', 'evening']) if (it[id]?.on) { const d = due(id, it[id].time); if (d) out.push(d); }
  if (it.water?.on) for (let h = 9; h <= 20; h += it.water.every) { const d = due('water', `${String(h).padStart(2, '0')}:00`); if (d) out.push(d); }
  return out;
}
const MEAL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
// null = skip because you have already done it (or it does not apply today)
export function buildMessage(id, db, lp) {
  const day = db?.days?.[lp.date], foods = day?.foods || [];
  if (MEAL[id]) return foods.some(f => f.meal === MEAL[id]) ? null : { title: `Time to log ${MEAL[id].toLowerCase()}`, body: 'A quick tap now keeps your day accurate.', url: '/#add', tag: id };
  if (id === 'water') {
    const w = db?.weights ? Object.entries(db.weights).sort().pop()?.[1] : 0, s = db?.settings || {};
    const goal = +s.waterMl > 0 ? +s.waterMl : Math.min(4000, Math.max(1500, Math.round((+w || 75) * 35 / 100) * 100)), ml = +day?.water || 0;
    return ml >= goal * .8 ? null : { title: 'Time for some water', body: ml ? `You are at ${ml} of ${goal} ml. Have a glass?` : 'Have a glass to get started.', url: '/#today', tag: 'water' };
  }
  if (id === 'workout') {
    const plan = db?.workout;
    if (db && (!plan?.days?.length || (plan.rest || []).includes(lp.wd) || plan.picks?.[lp.date] === 'rest' || (db.sessions || []).some(x => x.date === lp.date))) return null;
    return { title: 'Workout time', body: 'Your plan is ready. Start it, or mark it done in one tap.', url: '/#workout', tag: 'workout' };
  }
  if (id === 'evening') return db && foods.length >= 3 ? null : { title: 'Anything left to log?', body: 'Add what you ate today so your totals stay right.', url: '/#add', tag: 'evening' };
  return null;
}
// Contact claim sent to push services (an https URL or mailto). Set VAPID_SUBJECT in wrangler.toml.
export const subjectOf = env => env.VAPID_SUBJECT || 'https://calorytracker.banukamandinu.workers.dev';
export async function runReminders(env, now = new Date(), send = sendPush) {
  if (!env.DATA) return { users: 0, sent: 0 };
  const keys = await vapidKeys(env); let cursor, users = 0, sent = 0;
  do {
    const page = await env.DATA.list({ prefix: 'push:', cursor });
    for (const k of page.keys) {
      try {
        const rec = JSON.parse(await env.DATA.get(k.name) || 'null'); if (!rec?.subs?.length || !rec.prefs?.on || !validTz(rec.tz)) continue;
        users++; const lp = localParts(now, rec.tz), due = dueReminders(rec.prefs, lp, rec.sent);
        if (!due.length) continue;
        const raw = await env.DATA.get('data:' + k.name.slice(5)), db = raw ? JSON.parse(raw) : null; let changed = false;
        rec.sent = Object.fromEntries(Object.entries(rec.sent || {}).filter(([, d]) => d === lp.date)); // forget yesterday's markers
        for (const d of due) {
          const msg = buildMessage(d.id, db, lp); rec.sent[d.key] = lp.date; changed = true; if (!msg) continue;
          const alive = [];
          for (const s of rec.subs) { let st = 0; try { st = await send(s, msg, keys, subjectOf(env)); } catch { st = 0; } if (st !== 404 && st !== 410) alive.push(s); if (st >= 200 && st < 300) sent++; }
          rec.subs = alive;
        }
        if (changed) await env.DATA.put(k.name, JSON.stringify(rec));
      } catch (e) { console.log(JSON.stringify({ event: 'reminder_error', msg: String(e).slice(0, 120) })); }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  console.log(JSON.stringify({ t: now.toISOString(), event: 'reminders_run', users, sent }));
  return { users, sent };
}

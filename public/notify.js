'use strict';
/* Reminders (web push): turn them on for this device, choose what and when, send a test, turn them off.
   Loaded after app.js and shares its globals (api, $, esc ...). The server sends the notifications, so they arrive even when the app is closed. */
(() => {
  const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } };
  const DEFAULT = () => ({ on: true, items: { breakfast: { on: true, time: '08:00' }, lunch: { on: true, time: '13:00' }, dinner: { on: true, time: '19:30' }, water: { on: false, every: 3 }, workout: { on: true, time: '17:30' }, evening: { on: true, time: '21:00' } } });
  const ROWS = [['breakfast', 'Breakfast', 'Log your first meal'], ['lunch', 'Lunch', 'Log your midday meal'], ['dinner', 'Dinner', 'Log your evening meal'], ['water', 'Water', 'A nudge to drink through the day'], ['workout', 'Workout', 'On days your plan has a workout'], ['evening', 'Evening check-in', 'If your day looks incomplete']];
  let st = { loading: true, devices: 0, prefs: null, here: false, busy: false, msg: '', ok: '' }, saveT = null;
  const u8 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
  const sameKey = (sub, key) => { const k = sub.options?.applicationServerKey; return !k || btoa(String.fromCharCode(...new Uint8Array(k))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') === key; };

  async function mySub() { try { const reg = await navigator.serviceWorker.getRegistration(); return reg ? await reg.pushManager.getSubscription() : null; } catch { return null; } }
  async function refresh() {
    st.loading = true;
    try {
      const r = await api('GET', '/api/push'); st.devices = r.devices; st.prefs = r.prefs || st.prefs || DEFAULT();
      st.here = !!(await mySub()) && Notification.permission === 'granted';
      if (st.here && r.tz && r.tz !== tz()) api('PUT', '/api/push', { tz: tz() }).catch(() => { }); // keep reminders on your local clock when you travel
    } catch { st.msg = 'Could not reach the server.'; }
    st.loading = false;
  }

  function draw() {
    const el = $('#notify-body'); if (!el) return;
    if (!supported()) {
      el.innerHTML = `<p class="muted">${isIOS && !standalone() ? 'On iPhone and iPad, reminders work once the app is on your Home Screen: tap <b>Share</b>, then <b>Add to Home Screen</b>, and open the app from there.' : 'This browser does not support push notifications.'}</p>`;
      return;
    }
    if (st.loading && !st.prefs) { el.innerHTML = '<p class="muted small">Loading…</p>'; return; }
    const msg = st.msg ? `<p class="note">${esc(st.msg)}</p>` : st.ok ? `<p class="plan-suggest">${esc(st.ok)}</p>` : '';
    if (Notification.permission === 'denied') { el.innerHTML = `<p class="note">Notifications are blocked for this site. Allow them in your browser's site settings, then open this page again.</p>`; return; }
    if (!st.here) {
      el.innerHTML = `<p class="muted">Get a gentle nudge to log meals, drink water and train, even when the app is closed. Reminders are skipped when you have already done the thing.</p>${msg}
        <button class="btn primary block" data-nf-on${st.busy ? ' disabled' : ''}>${ico('plus')}Turn on reminders on this device</button>${st.devices ? `<p class="muted small">${st.devices} other device${st.devices > 1 ? 's are' : ' is'} already set up on this account.</p>` : ''}`;
      return;
    }
    const p = st.prefs;
    el.innerHTML = `${msg}<label class="nrow master"><span class="nlabel"><b>Reminders</b><small>${st.devices} device${st.devices === 1 ? '' : 's'} on this account</small></span><input type="checkbox" class="swt" data-nf="on" ${p.on ? 'checked' : ''} aria-label="Reminders on"></label>
      <div class="nlist${p.on ? '' : ' off'}">${ROWS.map(([id, name, sub]) => { const it = p.items[id];
        return `<div class="nrow"><span class="nlabel"><b>${name}</b><small>${sub}</small></span>
          ${id === 'water' ? `<select data-nf="water:every" aria-label="Water reminder spacing"><option value="2"${it.every === 2 ? ' selected' : ''}>Every 2 h</option><option value="3"${it.every === 3 ? ' selected' : ''}>Every 3 h</option><option value="4"${it.every === 4 ? ' selected' : ''}>Every 4 h</option></select>`
            : `<input type="time" data-nf="${id}:time" value="${it.time}" aria-label="${name} time">`}
          <input type="checkbox" class="swt" data-nf="${id}:on" ${it.on ? 'checked' : ''} aria-label="${name} reminder on"></div>`; }).join('')}</div>
      <div class="row"><button class="btn" data-nf-test${st.busy ? ' disabled' : ''}>Send a test</button><button class="btn quiet danger" data-nf-off${st.busy ? ' disabled' : ''}>Turn off on this device</button></div>
      <p class="muted small">Times use your phone's clock (${esc(tz())}). Water reminders run between 9:00 and 20:00.</p>`;
  }

  async function turnOn() {
    st.busy = true; st.msg = st.ok = ''; draw();
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { st.msg = perm === 'denied' ? '' : 'Permission was not given, so reminders stay off.'; return; }
      const cfg = await (await fetch('/api/config')).json(); if (!cfg.vapidPublicKey) throw new Error('Reminders are not available on the server yet.');
      const reg = await navigator.serviceWorker.ready; let sub = await reg.pushManager.getSubscription();
      if (sub && !sameKey(sub, cfg.vapidPublicKey)) { await sub.unsubscribe(); sub = null; }
      sub ||= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(cfg.vapidPublicKey) });
      await api('PUT', '/api/push', { sub: sub.toJSON(), prefs: st.prefs || DEFAULT(), tz: tz() });
      st.ok = 'Reminders are on. Send a test to see how they look.';
    } catch (e) { st.msg = String(e?.message || 'Could not turn on reminders.').slice(0, 160); }
    finally { st.busy = false; await refresh(); draw(); }
  }
  async function turnOff() {
    st.busy = true; st.msg = st.ok = ''; draw();
    try { const sub = await mySub(); if (sub) { const endpoint = sub.endpoint; await sub.unsubscribe(); await api('DELETE', '/api/push', { endpoint }); } st.ok = 'Reminders are off on this device.'; }
    catch { st.msg = 'Could not turn reminders off. Try again.'; }
    finally { st.busy = false; await refresh(); draw(); }
  }
  async function test() {
    st.busy = true; st.msg = st.ok = ''; draw();
    try { const r = await api('POST', '/api/push/test'); st.ok = r.sent ? 'Test sent. It should arrive in a few seconds.' : 'The test could not be delivered. Turn reminders off and on again on this device.'; }
    catch (e) { st.msg = e.status === 429 ? 'Please wait a few seconds between tests.' : 'The test could not be sent.'; }
    finally { st.busy = false; await refresh(); draw(); }
  }
  function savePrefs() { clearTimeout(saveT); saveT = setTimeout(() => api('PUT', '/api/push', { prefs: st.prefs, tz: tz() }).catch(() => { st.msg = 'Could not save your reminder times.'; draw(); }), 500); }

  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-nf-on')) turnOn(); else if (b.hasAttribute('data-nf-off')) turnOff(); else if (b.hasAttribute('data-nf-test')) test();
  });
  const onChange = e => {
    const f = e.target.dataset?.nf; if (!f || !st.prefs) return;
    const [id, field] = f.split(':'), t = e.target;
    if (id === 'on') st.prefs.on = t.checked;
    else if (field === 'on') st.prefs.items[id].on = t.checked;
    else if (field === 'every') st.prefs.items.water.every = +t.value;
    else if (field === 'time' && /^\d\d:\d\d$/.test(t.value)) st.prefs.items[id].time = t.value;
    else return;
    if (id === 'on') draw();
    savePrefs();
  };
  document.addEventListener('change', onChange);

  window.renderNotify = () => { draw(); refresh().then(draw); };
})();

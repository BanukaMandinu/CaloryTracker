'use strict';
/* Workout plan: view it, customise it, schedule it, and log the weight and reps of every set.
   Loaded after app.js and shares its globals (db, user, uid, esc, num, ico, save, render, toast ...). */
(() => {
  // The original 5-day plan is added to this account only. Everyone else starts with an empty plan and builds their own.
  const SEED_EMAIL = 'banukamandinu@gmail.com';
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const WDL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const INTENSITY = [['Moderate', 3.5], ['Hard', 5], ['Circuit', 8], ['Cardio', 7]];
  const nid = () => 'w' + uid();
  const E = (name, sets, reps, kind = 'reps', note = '') => ({ id: nid(), name, sets, reps: String(reps), kind, note });

  // Cycle order: plan Day 02 is the first workout and the cardio / bodyweight Day 01 is done last.
  function seedPlan() {
    return { v: 1, seeded: 'original', rest: [], days: [
      { id: 'd02', name: 'Chest & shoulders', label: 'Plan Day 02', met: 5, weekday: '', exercises: [
        E('Wide grip barbell decline press', 5, '15,12,12,12,12'), E('Flat bench press', 4, 12), E('Pec dec fly', 3, 12), E('Dumbbell incline press', 4, 12), E('Dumbbell pull over', 3, 12),
        E('Dumbbell military press', 4, 10, 'reps', 'Superset with side lateral raise'), E('Side lateral raise', 4, 10, 'reps', 'Superset with military press'),
        E('Dumbbell front raise', 4, 10, 'reps', 'Superset with bent over lateral raise'), E('Bent over lateral raise', 4, 10, 'reps', 'Superset with front raise'),
        E('Abs exercises', 1, '10 min', 'time')] },
      { id: 'd03', name: 'Back & legs', label: 'Plan Day 03', met: 5, weekday: '', exercises: [
        E('Cable lat pull over', 6, '8,12,8,12,8,12'), E('Close mag grip lat pulldown', 4, 15), E('Dumbbell row', 3, 12), E('Smith machine shrugs', 3, 15), E('Dumbbell deadlift', 3, 12),
        E('Leg curl', 3, 12), E('Barbell squats', 3, 15), E('Leg press', 3, 12), E('Machine calves', 4, 15)] },
      { id: 'd04', name: 'Arms & abs', label: 'Plan Day 04', met: 5, weekday: '', exercises: [
        E('Dumbbell decline fly', 4, 12), E('Wide decline push ups', 3, 12), E('Barbell curl', 5, '15,12,12,12,12'), E('Dumbbell hammer curl', 4, 12),
        E('Rivers curl combination with wrist curl', 3, 12), E('EZ bar overhead tricep extension', 4, 12), E('Cable rope press down tricep', 3, 12), E('Abs exercises', 1, '10 min', 'time')] },
      { id: 'd05', name: 'Chest, shoulders & core + cardio', label: 'Plan Day 05', met: 5, weekday: '', exercises: [
        E('Barbell incline press', 3, '6-10'), E('Barbell decline press', 3, '8-10'), E('Pec deck', 3, '10-15'), E('Dumbbell / cable pullover', 3, '10-15', 'reps', '2-3 sets'),
        E('Barbell overhead press', 3, '6-10'), E('Dumbbell lateral raise', 4, '12-15'), E('Rear delt fly / face pull', 3, '12-15'), E('Cable crunch', 3, '12-15'),
        E('Leg raises', 3, '10-15'), E('Plank', 3, '45-60 sec', 'time'), E('Incline treadmill or cycling', 1, '20-30 min', 'time')] },
      { id: 'd01', name: 'Cardio & bodyweight circuit', label: 'Plan Day 01', met: 8, weekday: '', exercises: [
        E('Treadmill run', 1, '15 min', 'time'), E('Cycling', 1, '10 min', 'time'), E('Wide grip push ups combined with close grip', 3, 20), E('In and out squat', 3, 10),
        E('Jumping jacks', 3, '60 sec', 'time'), E('Half burpees', 3, 10), E('High knees', 2, 20), E('Mountain climbers', 3, 20), E('High plank elbow to knee', 3, 20), E('Plank hold', 1, '60 sec', 'time')] }
    ] };
  }
  window.ensureWorkoutSeed = () => {
    if (db.workout || !user?.email || user.email.toLowerCase() !== SEED_EMAIL) return;
    db.workout = seedPlan(); save();
  };

  // ---------- helpers ----------
  const W = () => db.workout;
  const hasPlan = () => !!W()?.days?.length;
  const dayById = id => W()?.days.find(d => d.id === id);
  const sessions = () => db.sessions || (db.sessions = []);
  const sortedSessions = () => [...sessions()].sort((a, b) => a.date === b.date ? a.startedAt - b.startedAt : a.date < b.date ? -1 : 1);
  const wdOf = iso => new Date(iso + 'T12:00:00').getDay();
  const dayLabel = iso => iso === todayISO() ? 'Today' : iso === addDays(todayISO(), 1) ? 'Tomorrow' : `${WD[wdOf(iso)]} ${new Date(iso + 'T12:00:00').getDate()}`;
  const fmtDate = iso => new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const isFixed = d => d.weekday !== '' && d.weekday != null;
  function targetsOf(e) {
    const raw = String(e.reps || '').trim(), parts = raw.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length > 1) return parts;
    const n = Math.max(1, Math.round(num(e.sets)) || 1);
    return Array.from({ length: n }, () => raw || (e.kind === 'time' ? '60 sec' : '10'));
  }
  const schemeText = e => { const t = targetsOf(e); return new Set(t).size === 1 ? (e.kind === 'time' && t.length === 1 ? t[0] : `${t.length} × ${t[0]}`) : `${t.length} sets: ${t.join(', ')}`; };
  const firstNum = t => (String(t).match(/\d+(\.\d+)?/) || [''])[0];
  const volumeOf = s => Math.round(s.logs.reduce((a, l) => a + (l.kind === 'reps' ? l.sets.reduce((b, x) => b + (x.done ? num(x.w) * num(x.r) : 0), 0) : 0), 0));
  const doneSets = s => s.logs.reduce((a, l) => a + l.sets.filter(x => x.done).length, 0);

  // rolling cycle + fixed weekdays + rest days, projected for the next days
  const rollDays = () => W().days.filter(d => !isFixed(d));
  function lastRollIndex(roll) {
    const ids = roll.map(d => d.id), last = sortedSessions().filter(s => ids.includes(s.dayId)).pop();
    return last ? ids.indexOf(last.dayId) : -1;
  }
  function projection(n = 7) {
    const w = W(), roll = rollDays(), out = []; let ptr = roll.length ? (lastRollIndex(roll) + 1) % roll.length : 0;
    for (let i = 0; i < n; i++) {
      const date = addDays(todayISO(), i), wd = wdOf(date), done = sessions().filter(s => s.date === date);
      if (done.length) { out.push({ date, done }); continue; }
      const fixed = w.days.find(d => isFixed(d) && +d.weekday === wd);
      let day = null;
      if (fixed) day = fixed; else if (!(w.rest || []).includes(wd) && roll.length) { day = roll[ptr % roll.length]; ptr++; }
      out.push({ date, day, done: [] });
    }
    return out;
  }
  const positionOf = d => `${W().days.indexOf(d) + 1} of ${W().days.length}`;

  // ---------- Today card on the home screen ----------
  window.workoutTodayCard = () => {
    if (!hasPlan() || cur !== todayISO()) return '';
    const p = projection(3)[0];
    if (p.done.length) { const s = p.done[p.done.length - 1]; return `<div class="card wk-today"><div class="card-h"><h2>Today's workout</h2><span class="muted small">Done</span></div><p class="wk-name good">${ico('check')} ${esc(s.dayName)}</p><p class="muted small">${s.minutes} min · ${r0(s.kcal)} kcal · ${doneSets(s)} sets${volumeOf(s) ? ` · ${r0(volumeOf(s))} kg lifted` : ''}</p><a class="btn" href="#workout">Open workout</a></div>`; }
    if (!p.day) return `<div class="card wk-today"><div class="card-h"><h2>Today's workout</h2></div><p class="wk-name">Rest day</p><p class="muted small">Recover well. Your next session is on the Workout tab.</p><a class="btn" href="#workout">See schedule</a></div>`;
    return `<div class="card wk-today"><div class="card-h"><h2>Today's workout</h2><span class="muted small">Workout ${positionOf(p.day)}</span></div><p class="wk-name">${esc(p.day.name)}</p><p class="muted small">${p.day.exercises.length} exercises</p><div class="row"><button class="btn primary" data-wk-start="${esc(p.day.id)}" data-date="${p.date}">${ico('dumbbell')}Start workout</button><a class="btn" href="#workout">View plan</a></div></div>`;
  };

  // ---------- Workout page ----------
  function renderWorkout() {
    const el = $('#view-workout'), tabs = wtabs('workout');
    if (!hasPlan()) {
      el.innerHTML = tabs + `<div class="card"><div class="empty">${ico('dumbbell')}<p><b>No workout plan yet</b><br>Build your own: add days, exercises, sets and reps, then log your weights.</p></div><div class="row end"><button class="btn primary" data-wk-new>Create my plan</button></div></div>`;
      return;
    }
    const proj = projection(7), today = proj[0], w = W();
    const dayOptions = w.days.map((d, i) => `<option value="${esc(d.id)}">${i + 1}. ${esc(d.name)}</option>`).join('');
    const pick = today.day || (today.done.length ? null : rollDays()[0] || w.days[0]);
    const preview = d => d.exercises.slice(0, 6).map(e => `<li><span>${esc(e.name)}</span><b>${esc(schemeText(e))}</b></li>`).join('') + (d.exercises.length > 6 ? `<li class="muted small">+ ${d.exercises.length - 6} more</li>` : '');
    const todayCard = today.done.length
      ? `<div class="card"><div class="card-h"><h2>Today</h2><span class="muted small">${fmtDate(today.date)}</span></div><p class="wk-name good">${ico('check')} Done: ${esc(today.done[today.done.length - 1].dayName)}</p><p class="muted small">Nice work. You can still log another session below.</p></div>`
      : `<div class="card"><div class="card-h"><h2>${today.day ? "Today's workout" : 'Rest day'}</h2><span class="muted small">${today.day ? `Workout ${positionOf(today.day)}` : fmtDate(today.date)}</span></div>
          ${today.day ? `<p class="wk-name">${esc(today.day.name)}</p><ul class="wk-prev">${preview(today.day)}</ul>` : '<p class="muted">No workout planned today. Rest and recover, or train anyway below.</p>'}</div>`;
    const startCard = `<div class="card"><h2>Start a workout</h2>
        <div class="grid-form"><label class="span2">Workout<select id="wk-day">${dayOptions}</select></label><label class="span2">Date<input type="date" id="wk-date" value="${todayISO()}" max="${addDays(todayISO(), 30)}"></label></div>
        <button class="btn primary block" data-wk-startsel>${ico('dumbbell')}Start</button></div>`;
    const week = `<div class="card"><h2>Next 7 days</h2><div class="list wk-week">${proj.map(p => `<div class="item"><div class="n"><b>${dayLabel(p.date)}</b><span>${fmtDate(p.date)}</span></div>${p.done.length ? `<span class="wk-wn good">${ico('check')} ${esc(p.done[p.done.length - 1].dayName)}</span>` : p.day ? `<span class="wk-wn"><b>${esc(p.day.name)}</b></span><button class="btn sm" data-wk-start="${esc(p.day.id)}" data-date="${p.date}">Start</button>` : '<span class="wk-wn muted">Rest</span>'}</div>`).join('')}</div>
        <p class="muted small">The cycle moves on when you finish a session, so a missed day never loses your place.</p></div>`;
    const days = `<div class="card"><div class="card-h"><h2>Your plan</h2><button class="btn sm" data-wk-edit>${ico('pencil')}Edit plan</button></div>${w.days.map((d, i) => `<details class="wkday"><summary><span class="wk-n">${i + 1}</span><span class="wk-t"><b>${esc(d.name)}</b><small>${esc(d.label || '')}${d.label ? ' · ' : ''}${d.exercises.length} exercises${isFixed(d) ? ` · every ${WDL[+d.weekday]}` : ''}</small></span></summary>
        <ul class="wk-prev">${d.exercises.map(e => `<li><span>${esc(e.name)}${e.note ? `<small>${esc(e.note)}</small>` : ''}</span><b>${esc(schemeText(e))}</b></li>`).join('')}</ul>
        <div class="row"><button class="btn sm primary" data-wk-start="${esc(d.id)}" data-date="${todayISO()}">Start this day</button></div></details>`).join('')}</div>`;
    const recent = sortedSessions().slice(-8).reverse();
    const hist = `<div class="card"><h2>Recent sessions</h2>${recent.length ? recent.map(s => `<details class="wkday"><summary><span class="wk-t"><b>${esc(s.dayName)}</b><small>${fmtDate(s.date)} · ${s.minutes} min · ${doneSets(s)} sets${volumeOf(s) ? ` · ${r0(volumeOf(s))} kg` : ''}</small></span></summary>
        ${s.logs.map(l => `<div class="wk-log"><b>${esc(l.name)}</b><span>${l.sets.filter(x => x.done || x.w || x.r).map(x => l.kind === 'time' ? esc(x.r || 'done') : `${x.w || '–'}×${x.r || '–'}`).join(' · ') || '–'}</span></div>`).join('')}
        <div class="row"><button class="btn sm danger" data-wk-delsession="${esc(s.id)}">Delete session</button></div></details>`).join('') : `<div class="empty">${ico('history')}<p>Your finished sessions will appear here.</p></div>`}</div>`;
    el.innerHTML = tabs + `<div class="wk-grid"><div class="wk-col">${todayCard}${startCard}${week}</div><div class="wk-col">${days}${hist}</div></div>`;
    const sel = $('#wk-day'); if (sel && pick) sel.value = pick.id;
  }
  window.renderWorkout = renderWorkout;

  // ---------- logging a session ----------
  let S0 = null, sessionDirty = false;
  const draftKey = () => 'bmct.draft.' + (user?.uid || 'local');
  const saveDraft = () => { try { localStorage.setItem(draftKey(), JSON.stringify(S0)); } catch { } };
  const clearDraft = () => { try { localStorage.removeItem(draftKey()); } catch { } };
  function history(name) {
    const nm = name.toLowerCase(), logs = [];
    for (const s of sortedSessions()) for (const l of s.logs) if (l.name.toLowerCase() === nm && l.sets.some(x => x.done)) logs.push(l);
    return logs;
  }
  function newSession(day, date) {
    return { id: nid(), date, dayId: day.id, dayName: day.name, met: day.met || 5, startedAt: Date.now(), minutes: 0, kcal: 0, notes: '',
      logs: day.exercises.map(e => {
        const last = history(e.name).pop(), t = targetsOf(e);
        return { exId: e.id, name: e.name, kind: e.kind, note: e.note || '', target: t, sets: t.map((tt, i) => ({ w: e.kind === 'reps' && last ? String(last.sets[Math.min(i, last.sets.length - 1)]?.w ?? '') : '', r: '', done: false })) };
      }) };
  }
  function openSession(dayId, date) {
    const day = dayById(dayId); if (!day) return;
    let draft = null; try { draft = JSON.parse(localStorage.getItem(draftKey())); } catch { }
    if (draft && draft.dayId === dayId && draft.date === date && confirm('Continue the unfinished workout you started?')) S0 = draft;
    else S0 = newSession(day, date);
    sessionDirty = false; renderSession(); $('#wk-session').showModal();
  }
  function renderSession() {
    const s = S0; $('#ws-title').textContent = s.dayName;
    const mins = Math.max(1, Math.round((Date.now() - s.startedAt) / 60000)), est = s.date === todayISO() ? Math.min(180, Math.max(10, Math.round(mins / 5) * 5)) : 60;
    $('#ws-body').innerHTML = `
      <div class="card ws-top"><label>Date<input type="date" data-s="date" value="${s.date}"></label><p class="muted small">Tap ✓ when a set is done. Weights start from your last session.</p></div>
      ${s.logs.map((l, i) => { const h = history(l.name), last = h[h.length - 1];
        const best = l.kind === 'reps' ? h.flatMap(x => x.sets.filter(y => y.done)).reduce((m, y) => num(y.w) > num(m?.w ?? -1) ? y : m, null) : null;
        return `<div class="card ex"><div class="ex-h"><b>${esc(l.name)}</b><span class="muted small">${l.kind === 'time' ? esc(l.target.length > 1 ? l.target.join(', ') : l.target[0]) : esc(new Set(l.target).size === 1 ? `${l.target.length} × ${l.target[0]}` : l.target.join(', '))}</span></div>
          ${l.note ? `<p class="muted small ex-note">${esc(l.note)}</p>` : ''}
          ${last ? `<p class="muted small ex-last">Last: ${last.sets.filter(x => x.done).map(x => l.kind === 'time' ? esc(x.r || 'done') : `${x.w || '–'}×${x.r || '–'}`).join(' · ')}${best && num(best.w) ? ` · Best ${best.w} kg` : ''}</p>` : ''}
          <div class="sets ${l.kind}"><div class="sh"><span>Set</span><span>${l.kind === 'time' ? 'Target' : 'kg'}</span><span>${l.kind === 'time' ? 'Actual' : 'Reps'}</span><span></span></div>
          ${l.sets.map((x, j) => `<div class="sr${x.done ? ' done' : ''}"><span class="sn">${j + 1}</span>
            ${l.kind === 'time' ? `<span class="tg">${esc(l.target[Math.min(j, l.target.length - 1)])}</span><input data-sl="${i}:${j}:r" value="${esc(x.r)}" placeholder="optional" aria-label="Actual for set ${j + 1}">`
              : `<input type="number" step="0.5" min="0" inputmode="decimal" data-sl="${i}:${j}:w" value="${esc(x.w)}" placeholder="kg" aria-label="Weight for set ${j + 1}"><input type="number" step="1" min="0" inputmode="numeric" data-sl="${i}:${j}:r" value="${esc(x.r)}" placeholder="${esc(firstNum(l.target[Math.min(j, l.target.length - 1)]))}" aria-label="Reps for set ${j + 1}">`}
            <button type="button" class="tick" data-sdone="${i}:${j}" aria-pressed="${x.done}" aria-label="Set ${j + 1} done">${ico('check')}</button></div>`).join('')}</div>
          <div class="row"><button class="btn sm" data-sadd="${i}">+ Add set</button>${l.sets.length > 1 ? `<button class="btn sm quiet" data-sdel="${i}">Remove last set</button>` : ''}</div></div>`; }).join('')}
      <div class="card ws-end"><div class="grid-form"><label>Duration (min)<input type="number" min="1" max="360" inputmode="numeric" data-s="minutes" value="${s.minutes || est}"></label><label>Note <span class="opt">optional</span><input data-s="notes" value="${esc(s.notes)}" maxlength="120" placeholder="How did it feel?"></label></div>
        <button class="btn primary block" data-wk-finish>Finish and save</button><button class="btn quiet block" data-wk-discard>Discard workout</button></div>`;
  }
  function finishSession() {
    const s = S0, pd = dayById(s.dayId), minutes = Math.max(1, Math.round(num($('#ws-body [data-s="minutes"]').value)) || 1);
    if (!doneSets(s) && !confirm('No sets are ticked. Save this workout anyway?')) return;
    s.minutes = minutes; s.notes = $('#ws-body [data-s="notes"]').value.trim(); s.met = pd?.met || s.met || 5;
    s.kcal = Math.round(workoutKcal(s.met, minutes, weightOn(s.date)));
    s.logs.forEach(l => { l.sets = l.sets.filter(x => x.done || x.w !== '' || x.r !== ''); });
    sessions().push(s); db.sessions = sortedSessions().slice(-300);
    day(s.date).workouts.push({ id: nid(), cat: 'gym', type: s.dayName, min: minutes, kcal: s.kcal, note: 'From my plan' + (s.notes ? ': ' + s.notes : ''), sessionId: s.id });
    clearDraft(); sessionDirty = false; save(); $('#wk-session').close(); S0 = null; render();
    toast(`Workout saved · ${r0(s.kcal)} kcal burned · ${doneSets(s)} sets`);
  }
  function closeSession() {
    if (S0 && (sessionDirty || doneSets(S0)) && !confirm('Close without saving? Your progress is kept as a draft you can continue.')) return;
    $('#wk-session').close();
  }
  function deleteSession(id) {
    const s = sessions().find(x => x.id === id); if (!s || !confirm('Delete this session?')) return;
    db.sessions = sessions().filter(x => x.id !== id);
    const d = db.days[s.date]; if (d) d.workouts = d.workouts.filter(w => w.sessionId !== id);
    save(); render(); toast('Session deleted');
  }

  // ---------- plan editor ----------
  let ED = null, edBefore = '';
  const canReset = () => user?.email?.toLowerCase() === SEED_EMAIL;
  function openEditor() {
    ED = JSON.parse(JSON.stringify(W() || { v: 1, rest: [], days: [] })); ED.rest ||= []; edBefore = JSON.stringify(ED);
    renderEditor(); $('#wk-editor').showModal();
  }
  function renderEditor() {
    const body = $('#we-body'), keep = body.scrollTop;
    body.innerHTML = `
      <div class="card"><h2>Rest days</h2><p class="muted small">Days you never train. Leave all unticked to train every day.</p>
        <div class="chips-row">${WD.map((n, i) => `<button type="button" class="chipbtn${ED.rest.includes(i) ? ' on' : ''}" data-eact="rest" data-wd="${i}" aria-pressed="${ED.rest.includes(i)}">${n}</button>`).join('')}</div></div>
      ${ED.days.map((d, i) => `<div class="card edday"><div class="edday-h"><span class="wk-n">${i + 1}</span><input data-f="${i}||name" value="${esc(d.name)}" maxlength="60" aria-label="Day name" placeholder="Day name">
          <button type="button" class="icon-btn sm" data-eact="upday" data-d="${i}" aria-label="Move day up"${i === 0 ? ' disabled' : ''}>${ico('chev', 'flip')}</button><button type="button" class="icon-btn sm" data-eact="downday" data-d="${i}" aria-label="Move day down"${i === ED.days.length - 1 ? ' disabled' : ''}>${ico('chev')}</button>
          <button type="button" class="icon-btn sm" data-eact="delday" data-d="${i}" aria-label="Delete day">${ico('trash')}</button></div>
        <div class="grid-form"><label>Day of week<select data-f="${i}||weekday"><option value="">In the cycle</option>${WDL.map((n, k) => `<option value="${k}"${isFixed(d) && +d.weekday === k ? ' selected' : ''}>${n}s</option>`).join('')}</select></label>
          <label>Intensity<select data-f="${i}||met">${INTENSITY.map(([n, m]) => `<option value="${m}"${num(d.met) === m ? ' selected' : ''}>${n}</option>`).join('')}</select></label></div>
        ${d.exercises.map((e, k) => `<div class="exrow"><input data-f="${i}|${k}|name" value="${esc(e.name)}" maxlength="80" placeholder="Exercise" aria-label="Exercise name">
            <div class="exrow-b"><label>Sets<input type="number" min="1" max="20" inputmode="numeric" data-f="${i}|${k}|sets" value="${esc(String(e.sets))}"></label><label>Reps<input data-f="${i}|${k}|reps" value="${esc(e.reps)}" placeholder="12 or 15,12" maxlength="40"></label>
              <label>Type<select data-f="${i}|${k}|kind"><option value="reps"${e.kind === 'reps' ? ' selected' : ''}>Reps</option><option value="time"${e.kind === 'time' ? ' selected' : ''}>Timed</option></select></label></div>
            <input data-f="${i}|${k}|note" value="${esc(e.note || '')}" maxlength="80" placeholder="Note (optional)" aria-label="Note">
            <div class="exrow-c"><button type="button" class="icon-btn sm" data-eact="upex" data-d="${i}" data-e="${k}" aria-label="Move up"${k === 0 ? ' disabled' : ''}>${ico('chev', 'flip')}</button><button type="button" class="icon-btn sm" data-eact="downex" data-d="${i}" data-e="${k}" aria-label="Move down"${k === d.exercises.length - 1 ? ' disabled' : ''}>${ico('chev')}</button><button type="button" class="icon-btn sm" data-eact="delex" data-d="${i}" data-e="${k}" aria-label="Delete exercise">${ico('trash')}</button></div></div>`).join('')}
        <button type="button" class="btn sm" data-eact="addex" data-d="${i}">+ Add exercise</button></div>`).join('')}
      <button type="button" class="btn block" data-eact="addday">+ Add a day</button>
      <div class="card ed-end"><div class="row"><button class="btn primary" data-eact="save">Save plan</button><button class="btn" data-eact="cancel">Cancel</button></div>${canReset() ? '<button type="button" class="btn quiet sm" data-eact="reset">Restore my original 5-day plan</button>' : ''}</div>`;
    body.scrollTop = keep;
  }
  function savePlan() {
    for (const d of ED.days) {
      d.name = (d.name || '').trim() || 'Workout';
      d.exercises = d.exercises.filter(e => (e.name || '').trim()).map(e => ({ ...e, name: e.name.trim(), sets: Math.max(1, Math.min(20, Math.round(num(e.sets)) || 1)), reps: String(e.reps || '').trim() || (e.kind === 'time' ? '60 sec' : '10') }));
    }
    db.workout = ED; save(); $('#wk-editor').close(); ED = null; render(); toast('Plan saved');
  }
  function closeEditor() {
    if (ED && JSON.stringify(ED) !== edBefore && !confirm('Discard your changes to the plan?')) return;
    $('#wk-editor').close(); ED = null;
  }
  const mv = (a, i, j) => { if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; };

  // ---------- wiring ----------
  document.body.insertAdjacentHTML('beforeend', `
    <dialog id="wk-session" class="sheet" aria-labelledby="ws-title"><div class="sheet-h"><b id="ws-title"></b><button class="icon-btn" data-wk-close="session" aria-label="Close">${ico('close')}</button></div><div class="sheet-body" id="ws-body"></div></dialog>
    <dialog id="wk-editor" class="sheet" aria-labelledby="we-title"><div class="sheet-h"><b id="we-title">Edit workout plan</b><button class="icon-btn" data-eact="cancel" aria-label="Close">${ico('close')}</button></div><div class="sheet-body" id="we-body"></div></dialog>`);
  $('#wk-session').addEventListener('cancel', e => { e.preventDefault(); closeSession(); });
  $('#wk-editor').addEventListener('cancel', e => { e.preventDefault(); closeEditor(); });
  $('#wk-session').addEventListener('close', () => { S0 = null; });

  document.addEventListener('click', e => {
    const t = e.target.closest('button,a'); if (!t) return;
    const d = t.dataset;
    if (d.wkStart) { openSession(d.wkStart, d.date || todayISO()); return; }
    if (d.wkStartsel !== undefined) { const date = $('#wk-date').value || todayISO(); openSession($('#wk-day').value, date); return; }
    if (d.wkNew !== undefined) { db.workout = { v: 1, rest: [], days: [{ id: nid(), name: 'Day 1', label: '', met: 5, weekday: '', exercises: [E('', 3, 10)] }] }; save(); openEditor(); render(); return; }
    if (d.wkEdit !== undefined) { openEditor(); return; }
    if (d.wkDelsession) { deleteSession(d.wkDelsession); return; }
    if (d.wkClose === 'session') { closeSession(); return; }
    if (d.wkFinish !== undefined) { finishSession(); return; }
    if (d.wkDiscard !== undefined) { if (confirm('Discard this workout?')) { clearDraft(); sessionDirty = false; $('#wk-session').close(); } return; }
    if (d.sdone) { const [i, j] = d.sdone.split(':').map(Number), x = S0.logs[i].sets[j]; x.done = !x.done; if (x.done && x.r === '' && S0.logs[i].kind === 'reps') x.r = firstNum(S0.logs[i].target[Math.min(j, S0.logs[i].target.length - 1)]); sessionDirty = true; saveDraft(); renderSession(); return; }
    if (d.sadd !== undefined) { const l = S0.logs[+d.sadd], p = l.sets[l.sets.length - 1]; l.sets.push({ w: p?.w ?? '', r: '', done: false }); l.target.push(l.target[l.target.length - 1]); sessionDirty = true; saveDraft(); renderSession(); return; }
    if (d.sdel !== undefined) { const l = S0.logs[+d.sdel]; if (l.sets.length > 1) { l.sets.pop(); l.target.pop(); sessionDirty = true; saveDraft(); renderSession(); } return; }
    if (d.eact && ED) {
      const a = d.eact, di = +d.d, ei = +d.e;
      if (a === 'save') savePlan();
      else if (a === 'cancel') closeEditor();
      else if (a === 'rest') { const k = +d.wd, i = ED.rest.indexOf(k); i >= 0 ? ED.rest.splice(i, 1) : ED.rest.push(k); renderEditor(); }
      else if (a === 'addday') { ED.days.push({ id: nid(), name: `Day ${ED.days.length + 1}`, label: '', met: 5, weekday: '', exercises: [E('', 3, 10)] }); renderEditor(); }
      else if (a === 'delday') { if (confirm(`Delete "${ED.days[di].name}"?`)) { ED.days.splice(di, 1); renderEditor(); } }
      else if (a === 'upday') { mv(ED.days, di, di - 1); renderEditor(); } else if (a === 'downday') { mv(ED.days, di, di + 1); renderEditor(); }
      else if (a === 'addex') { ED.days[di].exercises.push(E('', 3, 10)); renderEditor(); }
      else if (a === 'delex') { ED.days[di].exercises.splice(ei, 1); renderEditor(); }
      else if (a === 'upex') { mv(ED.days[di].exercises, ei, ei - 1); renderEditor(); } else if (a === 'downex') { mv(ED.days[di].exercises, ei, ei + 1); renderEditor(); }
      else if (a === 'reset') { if (confirm('Replace everything with your original 5-day plan? Your logged sessions are kept.')) { ED = seedPlan(); renderEditor(); } }
    }
  });
  const onField = e => {
    const t = e.target;
    if (t.dataset.sl && S0) { const [i, j, f] = t.dataset.sl.split(':'); S0.logs[+i].sets[+j][f] = t.value; sessionDirty = true; saveDraft(); return; }
    if (t.dataset.s && S0) { S0[t.dataset.s] = t.value; sessionDirty = true; return; }
    if (t.dataset.f && ED) {
      const [di, ei, f] = t.dataset.f.split('|'), day = ED.days[+di];
      if (ei === '') day[f] = f === 'met' ? +t.value : t.value; else day.exercises[+ei][f] = t.value;
    }
  };
  document.addEventListener('input', onField); document.addEventListener('change', onField);
})();

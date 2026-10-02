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
  const TIPS = ['Rest 60–90 seconds between normal sets, and 2–3 minutes after heavy compound lifts.',
    'Choose a weight that lets you finish the target reps with good form. When you can comfortably beat the target, add a little weight.',
    'Keep your protein high and hold your calorie deficit while cutting.',
    'Belly fat cannot be spot-reduced. Overall fat loss gradually reduces belly and lower-back fat.',
    'Keep cardio moderate so it does not hurt your recovery from lifting.',
    'If an exercise causes back or sciatica pain, stop and swap it. Do not push through pain.'];
  // 6-day plan: 5 resistance days + 1 cardio day, Sunday is rest. The cycle follows the order below and skips Sunday.
  function seedPlan() {
    const day = (id, label, name, tags, color, met, exercises, note = '') => ({ id, label, name, tags, color, met, weekday: '', note, exercises });
    return { v: 2, seeded: 'v2', rest: [0], picks: {}, tips: TIPS, days: [
      day('p1', 'Day 1 · Push', 'Chest + Shoulders + Triceps', ['Chest', 'Shoulders', 'Triceps'], 0, 5, [
        E('Incline dumbbell press', 4, 12), E('Flat bench press', 4, 12), E('Wide-grip barbell decline press', 3, 12), E('Pec deck fly', 3, 12), E('Dumbbell pullover', 3, 12),
        E('Seated dumbbell shoulder press', 3, 10), E('Dumbbell lateral raise', 3, '10-12'), E('Cable rope triceps pressdown', 3, 12), E('Abs exercises', 1, '10 min', 'time')]),
      day('p2', 'Day 2 · Pull + legs', 'Back + Biceps + Legs', ['Back', 'Biceps', 'Legs'], 1, 5, [
        E('Close-grip lat pulldown', 4, 15), E('Dumbbell row', 3, 12), E('Cable lat pullover', 3, 12), E('Barbell squat', 3, 15), E('Dumbbell deadlift', 3, 12),
        E('Leg press', 3, 12), E('Leg curl', 3, 12), E('Machine calves', 4, 15), E('Barbell curl', 3, 12)]),
      day('p3', 'Day 3 · Push', 'Chest + Shoulders + Triceps', ['Chest', 'Shoulders', 'Triceps'], 0, 5, [
        E('Barbell incline press', 3, '8-10'), E('Dumbbell decline fly', 3, 12), E('Wide decline push-ups', 3, 12), E('Dumbbell lateral raise', 3, '12-15'), E('Face pulls', 3, '12-15'),
        E('EZ-bar overhead triceps extension', 3, 12), E('Cable rope triceps pressdown', 3, 12), E('Abs exercises', 1, '10 min', 'time')]),
      day('p4', 'Day 4 · Pull + legs', 'Back + Biceps + Legs', ['Back', 'Biceps', 'Legs'], 1, 5, [
        E('Lat pulldown', 3, '10-12'), E('Seated cable row', 3, '10-12'), E('Dumbbell row', 2, '10-12'), E('Leg press', 3, 12), E('Leg curl', 3, 12),
        E('Machine calves', 3, 15), E('Barbell curl', 4, 12), E('Dumbbell hammer curl', 4, 12), E('Reverse curl + wrist curl', 3, 12)]),
      day('p5', 'Day 5 · Upper body', 'Chest + Arms + Shoulders', ['Chest', 'Arms', 'Shoulders'], 2, 5, [
        E('Barbell incline press', 3, '8-10'), E('Pec deck fly', 3, '12-15'), E('Dumbbell pullover', 2, 12), E('Dumbbell lateral raise', 3, '12-15'), E('Face pulls / reverse pec deck', 3, '12-15'),
        E('Dumbbell hammer curl', 3, 12), E('EZ-bar overhead triceps extension', 3, 12), E('Cable rope triceps pressdown', 2, 12), E('Abs exercises', 1, '10 min', 'time')],
        'A moderate-volume chest session, so you are not too tired after Days 1 and 3.'),
      day('p6', 'Day 6 · Cardio', 'Cardio + Conditioning', ['Cardio', 'Core'], 5, 7, [
        E('Treadmill walking', 1, '30-40 min', 'time'), E('Cycling', 1, '20-30 min', 'time'), E('Jumping jacks', 3, '60 sec', 'time'), E('Half burpees', 3, 10), E('High knees', 3, 20),
        E('Mountain climbers', 3, 20), E('High plank elbow-to-knee', 3, 20), E('Plank hold', 3, '60 sec', 'time'), E('Badminton', 1, '2-3 hours', 'time', 'Optional')])
    ] };
  }
  // The owner account gets this plan. It replaces the earlier plan once (marked seeded 'v2'); after that your own edits are never overwritten.
  window.ensureWorkoutSeed = () => {
    if (!user?.email || user.email.toLowerCase() !== SEED_EMAIL) return;
    if (db.workout && db.workout.seeded === 'v2') return;
    if (db.workout && db.workout.seeded !== 'original') return; // a plan you built yourself is left alone
    db.workout = seedPlan(); save();
  };

  // ---------- helpers ----------
  const W = () => db.workout;
  const hasPlan = () => !!W()?.days?.length;
  const dayById = id => W()?.days.find(d => d.id === id);
  const picksOf = () => (W().picks ||= {});
  const sessions = () => db.sessions || (db.sessions = []);
  const sortedSessions = () => [...sessions()].sort((a, b) => a.date === b.date ? a.startedAt - b.startedAt : a.date < b.date ? -1 : 1);
  const wdOf = iso => new Date(iso + 'T12:00:00').getDay();
  const dnum = iso => new Date(iso + 'T12:00:00').getDate();
  const fmtDate = iso => new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtLong = iso => iso === todayISO() ? `Today · ${fmtDate(iso)}` : iso === addDays(todayISO(), 1) ? `Tomorrow · ${fmtDate(iso)}` : iso === addDays(todayISO(), -1) ? `Yesterday · ${fmtDate(iso)}` : fmtDate(iso);
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
  // typical length of a workout: average of your last sessions of that day, else a sensible default
  function usualMinutes(pd) {
    const past = sortedSessions().filter(s => s.dayId === pd.id && s.minutes).slice(-3);
    return past.length ? (Math.round(past.reduce((a, s) => a + s.minutes, 0) / past.length / 5) * 5 || 60) : (pd.met >= 7 ? 45 : 60);
  }

  // Schedule: your own choice for a date wins, then fixed weekdays and rest days, then the rolling cycle (which only moves on when you finish a session).
  const rollDays = () => W().days.filter(d => !isFixed(d));
  function lastRollIndex(roll) {
    const ids = roll.map(d => d.id), last = sortedSessions().filter(s => ids.includes(s.dayId)).pop();
    return last ? ids.indexOf(last.dayId) : -1;
  }
  function projection(n = 7) {
    const w = W(), roll = rollDays(), picks = picksOf(), out = []; let ptr = roll.length ? (lastRollIndex(roll) + 1) % roll.length : 0;
    for (let i = 0; i < n; i++) {
      const date = addDays(todayISO(), i), wd = wdOf(date), done = sessions().filter(s => s.date === date), pick = picks[date];
      if (done.length) { out.push({ date, done }); continue; }
      let day = null, picked = false;
      if (pick === 'rest') picked = true;
      else if (pick && dayById(pick)) { day = dayById(pick); picked = true; const ri = roll.findIndex(d => d.id === day.id); if (ri >= 0) ptr = (ri + 1) % roll.length; }
      else {
        const fixed = w.days.find(d => isFixed(d) && +d.weekday === wd);
        if (fixed) day = fixed; else if (!(w.rest || []).includes(wd) && roll.length) { day = roll[ptr % roll.length]; ptr++; }
      }
      out.push({ date, day, done: [], picked });
    }
    return out;
  }
  function entryFor(date) {
    const t = todayISO();
    if (date < t) return { date, done: sessions().filter(s => s.date === date), day: null, past: true };
    const n = Math.round((new Date(date) - new Date(t)) / 864e5) + 1;
    return projection(n)[n - 1];
  }
  const positionOf = d => `${W().days.indexOf(d) + 1} of ${W().days.length}`;
  const estKcal = (pd, date) => Math.round(workoutKcal(pd.met || 5, usualMinutes(pd), weightOn(date)));

  // The workout planned for today counts towards today's calories out until you log the real one (a setting in Profile).
  window.plannedWorkoutKcal = d => {
    try {
      if (!hasPlan() || d !== todayISO() || db.settings.countPlanned === 'off') return 0;
      const p = projection(1)[0];
      return !p || p.done.length || !p.day ? 0 : estKcal(p.day, d);
    } catch { return 0; }
  };

  // ---------- Today card on the home screen ----------
  window.workoutTodayCard = () => {
    if (!hasPlan() || cur !== todayISO()) return '';
    const p = projection(1)[0], head = `<div class="card-h"><h2>Today's workout</h2>`;
    if (p.done.length) { const s = p.done[p.done.length - 1]; return `<div class="card wk-today">${head}<span class="good small">${ico('check')} Done</span></div><p class="wk-name">${esc(s.dayName)}</p><p class="muted small">${s.minutes} min · ${r0(s.kcal)} kcal${doneSets(s) ? ` · ${doneSets(s)} sets` : ''}${volumeOf(s) ? ` · ${r0(volumeOf(s))} kg lifted` : ''}</p><a class="btn" href="#workout">Open workout</a></div>`; }
    if (!p.day) return `<div class="card wk-today">${head}</div><p class="wk-name">Rest day</p><p class="muted small">Recover well, or pick a workout if you feel like training.</p><div class="row"><button class="btn primary" data-wk-pick="${p.date}">Choose a workout</button></div></div>`;
    return `<div class="card wk-today">${head}<span class="muted small">Workout ${positionOf(p.day)}</span></div><p class="wk-name">${esc(p.day.name)}</p><p class="muted small">${p.day.exercises.length} exercises · about ${usualMinutes(p.day)} min · ~${r0(estKcal(p.day, p.date))} kcal</p><div class="row"><button class="btn primary" data-wk-start="${esc(p.day.id)}" data-date="${p.date}">${ico('dumbbell')}Start</button><button class="btn" data-wk-markdone="${esc(p.day.id)}" data-date="${p.date}">${ico('check')}Mark done</button><button class="btn quiet" data-wk-pick="${p.date}">Change</button></div></div>`;
  };

  // ---------- Workout page ----------
  const colorOf = (d, i) => `var(--c${(Number.isInteger(d.color) ? d.color : i) % 6})`;
  const typeOf = d => (String(d.label || '').split('·')[1] || '').trim();
  const typeChip = d => typeOf(d) ? `<span class="tag">${esc(typeOf(d))}</span>` : '';
  const mondayOf = iso => addDays(iso, -((wdOf(iso) + 6) % 7));

  function weekRow(date) {
    const w = W(), t = todayISO(), e = entryFor(date), done = e.done?.length ? e.done[e.done.length - 1] : null, d = e.day, isToday = date === t;
    const di = d ? w.days.indexOf(d) : -1, past = date < t;
    const doneDay = done && dayById(done.dayId), shown = d || doneDay, si = shown ? w.days.indexOf(shown) : -1;
    const state = done ? `<span class="wstate ok">${ico('check')}Done</span>` : d ? `<span class="wstate plan">${d.exercises.length} exercises</span>` : past ? `<span class="wstate dim">–</span>` : `<span class="wstate dim">Rest</span>`;
    const title = done ? done.dayName : d ? d.name : past ? 'Nothing logged' : 'Rest day';
    const attr = shown ? `data-wk-open="${esc(shown.id)}" data-date="${date}"` : `data-wk-pick="${date}"`;
    return `<button class="wrow${isToday ? ' today' : ''}${done ? ' isdone' : ''}${!shown ? ' rest' : ''}" style="--wc:${shown ? colorOf(shown, si) : 'var(--line)'}" ${attr} aria-label="${fmtDate(date)}: ${esc(title)}">
      <span class="wdate"><small>${WD[wdOf(date)]}</small><b>${dnum(date)}</b></span>
      <span class="wbody"><b>${esc(title)}</b>${shown ? `<span class="tags">${typeChip(shown)}</span>` : ''}</span>${isToday ? '<span class="wtoday">Today</span>' : ''}${state}</button>`;
  }

  function renderWorkout() {
    const el = $('#view-workout');
    if (!hasPlan()) {
      el.innerHTML = `<div class="card"><div class="empty">${ico('dumbbell')}<p><b>No workout plan yet</b><br>Build your own: add days, exercises, sets and reps, then log your weights.</p></div><div class="row end"><button class="btn primary" data-wk-new>Create my plan</button></div></div>`;
      return;
    }
    const w = W(), t = todayISO(), te = entryFor(t);
    let hero;
    if (te.done.length) { const s = te.done[te.done.length - 1]; hero = `<div class="wk-hero done"><small>${fmtLong(t)}</small><h2>${ico('check')} ${esc(s.dayName)}</h2><p>Done · ${s.minutes} min · ${r0(s.kcal)} kcal${doneSets(s) ? ` · ${doneSets(s)} sets` : ''}</p><div class="row"><button class="btn" data-wk-pick="${t}">Do another</button><button class="btn quiet" data-wk-undo="${esc(s.id)}">Undo</button></div></div>`; }
    else if (te.day) hero = `<div class="wk-hero"><small>${fmtLong(t)} · Workout ${positionOf(te.day)}</small><h2>${esc(te.day.name)}</h2><p>${te.day.exercises.length} exercises · about ${usualMinutes(te.day)} min · ~${r0(estKcal(te.day, t))} kcal</p>
        <div class="row"><button class="btn pop" data-wk-start="${esc(te.day.id)}" data-date="${t}">${ico('dumbbell')}Start workout</button><button class="btn ghost" data-wk-markdone="${esc(te.day.id)}" data-date="${t}">${ico('check')}Mark done</button></div><button class="wk-change" data-wk-pick="${t}">Not this one? Change or skip today</button></div>`;
    else hero = `<div class="wk-hero rest"><small>${fmtLong(t)}</small><h2>Rest day</h2><p>Nothing planned. Recover well, or train anyway.</p><div class="row"><button class="btn pop" data-wk-pick="${t}">Choose a workout</button></div></div>`;

    const week = `<div class="card"><div class="card-h"><h2>This week</h2><span class="muted small">Tap a day for details</span></div><div class="wweek">${Array.from({ length: 7 }, (_, i) => weekRow(addDays(mondayOf(t), i))).join('')}</div></div>`;

    const plan = `<div class="card"><div class="card-h"><h2>Your plan</h2><button class="btn sm" data-wk-edit>${ico('pencil')}Edit</button></div>
      <div class="pgrid">${w.days.map((d, i) => `<button class="pcard" style="--wc:${colorOf(d, i)}" data-wk-open="${esc(d.id)}" data-date="${t}"><span class="pnum">${esc(d.label || `Day ${i + 1}`)}</span><b>${esc(d.name)}</b><span class="pmeta">${d.exercises.length} exercises · ~${usualMinutes(d)} min</span></button>`).join('')}</div>
      <p class="muted small">Rest days: ${(w.rest || []).length ? w.rest.map(i => WDL[i]).join(', ') : 'none'}. Change them in Edit.</p></div>`;
    const tips = w.tips?.length ? `<details class="card tips"><summary><b>Training tips</b></summary><ul>${w.tips.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>` : '';
    const recent = sortedSessions().slice(-8).reverse();
    const hist = `<div class="card"><h2>Recent sessions</h2>${recent.length ? recent.map(s => `<details class="wkday"><summary><span class="wk-t"><b>${esc(s.dayName)}</b><small>${fmtDate(s.date)} · ${s.minutes} min${doneSets(s) ? ` · ${doneSets(s)} sets` : ' · marked done'}${volumeOf(s) ? ` · ${r0(volumeOf(s))} kg` : ''}</small></span></summary>
        ${s.logs.map(l => `<div class="wk-log"><b>${esc(l.name)}</b><span>${l.sets.filter(x => x.done || x.w || x.r).map(x => l.kind === 'time' ? esc(x.r || 'done') : `${x.w || '–'}×${x.r || '–'}`).join(' · ') || '–'}</span></div>`).join('')}
        <div class="row"><button class="btn sm danger" data-wk-delsession="${esc(s.id)}">Delete</button></div></details>`).join('') : `<div class="empty">${ico('history')}<p>Finished sessions will appear here.</p></div>`}</div>`;
    el.innerHTML = `<div class="wk-grid"><div class="wk-col">${hero}${week}</div><div class="wk-col">${plan}${tips}${hist}</div></div>`;
  }
  window.renderWorkout = renderWorkout;

  // ---------- one workout in detail (opened from the week list or the plan cards) ----------
  let DT = null;
  function renderDetail() {
    const w = W(), d = dayById(DT.dayId), i = w.days.indexOf(d), e = entryFor(DT.date), past = DT.date < todayISO();
    const doneHere = (e.done || []).find(s => s.dayId === d.id);
    $('#wd-title').textContent = d.name;
    $('#wd-body').innerHTML = `<div class="wd-top" style="--wc:${colorOf(d, i)}"><span class="pnum">${esc(d.label || `Day ${i + 1}`)}</span>
        <p>${fmtLong(DT.date)} · ${d.exercises.length} exercises · about ${usualMinutes(d)} min · ~${r0(estKcal(d, DT.date))} kcal</p>${d.note ? `<p class="wd-note">${esc(d.note)}</p>` : ''}${doneHere ? `<p class="wd-done">${ico('check')} Done · ${doneHere.minutes} min</p>` : ''}</div>
      <ol class="wd-list">${d.exercises.map(x => `<li><span class="wd-n">${d.exercises.indexOf(x) + 1}</span><span class="wd-t"><b>${esc(x.name)}</b>${x.note ? `<small>${esc(x.note)}</small>` : ''}</span><span class="wd-s">${esc(schemeText(x))}</span></li>`).join('')}</ol>
      <div class="wd-actions"><button class="btn pop" data-wd-act="start">${ico('dumbbell')}${past ? 'Log this workout' : 'Start workout'}</button><button class="btn" data-wd-act="done">${ico('check')}Mark as done</button>
        <button class="btn quiet" data-wd-act="change">${past ? 'Pick a different workout' : 'Change this day'}</button></div>`;
  }
  function openDetail(dayId, date) { if (!dayById(dayId)) { openPick(date); return; } DT = { dayId, date }; renderDetail(); $('#wk-detail').showModal(); }

  // ---------- choose a workout for a day (or skip it, or mark it done) ----------
  let PK = null;
  function renderPick() {
    const w = W(), e = entryFor(PK.date), past = !!e.past;
    $('#wp-title').textContent = fmtLong(PK.date);
    const doneLine = e.done?.length ? `<p class="good small">${ico('check')} Already done: ${esc(e.done[e.done.length - 1].dayName)}</p>` : '';
    $('#wp-body').innerHTML = `${doneLine}<p class="muted small">${past ? 'Pick the workout you did.' : 'Choose what you will do on this day.'}</p>
      <div class="pickgrid">${w.days.map((d, i) => `<button type="button" class="pickrow${PK.sel === d.id ? ' on' : ''}" data-wp-sel="${esc(d.id)}" role="radio" aria-checked="${PK.sel === d.id}"><span class="wk-n">${i + 1}</span><span class="wk-t"><b>${esc(d.name)}</b><small>${d.exercises.length} exercises</small></span><span class="pk-tick">${ico('check')}</span></button>`).join('')}
        ${past ? '' : `<button type="button" class="pickrow${PK.sel === 'rest' ? ' on' : ''}" data-wp-sel="rest" role="radio" aria-checked="${PK.sel === 'rest'}"><span class="wk-n">–</span><span class="wk-t"><b>Rest day</b><small>Skip training; your cycle keeps its place</small></span><span class="pk-tick">${ico('check')}</span></button>`}</div>
      <div class="pk-actions">
        <button class="btn pop" data-wp-act="start"${!PK.sel || PK.sel === 'rest' ? ' disabled' : ''}>${ico('dumbbell')}Start workout</button>
        <button class="btn" data-wp-act="done"${!PK.sel || PK.sel === 'rest' ? ' disabled' : ''}>${ico('check')}Mark as done</button>
        ${past ? '' : `<button class="btn quiet" data-wp-act="save">Just save my choice</button>`}
        <button class="btn quiet" data-wp-act="close">Cancel</button></div>`;
  }
  function openPick(date) {
    const e = entryFor(date); PK = { date, sel: e.day?.id || (e.picked || (!e.past && !e.done?.length && !e.day) ? 'rest' : '') };
    if (e.done?.length && !e.day) PK.sel = '';
    renderPick(); $('#wk-pick').showModal();
  }
  function applyPick() {
    if (PK.date < todayISO()) return;
    const picks = picksOf(); picks[PK.date] = PK.sel || undefined; if (!PK.sel) delete picks[PK.date];
    Object.keys(picks).forEach(k => { if (k < addDays(todayISO(), -2)) delete picks[k]; });
  }

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
  async function openSession(dayId, date) {
    const day = dayById(dayId); if (!day) return;
    let draft = null; try { draft = JSON.parse(localStorage.getItem(draftKey())); } catch { }
    if (draft && draft.dayId === dayId && draft.date === date && await ask({ title: 'Continue your workout?', text: 'You have an unfinished workout from earlier.', ok: 'Continue', cancel: 'Start fresh' })) S0 = draft;
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
  // record a finished session and put its calories on that day
  function recordSession(s, pd) {
    sessions().push(s); db.sessions = sortedSessions().slice(-300);
    if (W()) delete picksOf()[s.date];
    day(s.date).workouts.push({ id: nid(), cat: 'gym', type: s.dayName, min: s.minutes, kcal: s.kcal, note: s.quick ? 'Marked done' : 'From my plan' + (s.notes ? ': ' + s.notes : ''), sessionId: s.id });
    save(); render();
  }
  async function finishSession() {
    const s = S0, pd = dayById(s.dayId), minutes = Math.max(1, Math.round(num($('#ws-body [data-s="minutes"]').value)) || 1);
    if (!doneSets(s) && !(await ask({ title: 'Save without any sets?', text: 'No sets are ticked yet. Save this workout anyway?', ok: 'Save anyway', cancel: 'Go back' }))) return;
    s.minutes = minutes; s.notes = $('#ws-body [data-s="notes"]').value.trim(); s.met = pd?.met || s.met || 5;
    s.kcal = Math.round(workoutKcal(s.met, minutes, weightOn(s.date)));
    s.logs.forEach(l => { l.sets = l.sets.filter(x => x.done || x.w !== '' || x.r !== ''); });
    clearDraft(); sessionDirty = false; $('#wk-session').close(); S0 = null;
    recordSession(s, pd); toast(`Workout saved · ${r0(s.kcal)} kcal`);
  }
  // quick "I did this one": no sets, uses your usual duration
  function markDone(dayId, date) {
    const pd = dayById(dayId); if (!pd) return;
    const minutes = usualMinutes(pd), s = { id: nid(), date, dayId, dayName: pd.name, met: pd.met || 5, startedAt: Date.now(), minutes, kcal: Math.round(workoutKcal(pd.met || 5, minutes, weightOn(date))), notes: '', quick: true, logs: [] };
    recordSession(s, pd); toast(`${pd.name} done · ${r0(s.kcal)} kcal`, () => deleteSession(s.id, true));
  }
  async function closeSession() {
    if (S0 && (sessionDirty || doneSets(S0)) && !(await ask({ title: 'Leave this workout?', text: 'Your progress is kept as a draft you can continue.', ok: 'Leave', cancel: 'Stay' }))) return;
    $('#wk-session').close();
  }
  async function deleteSession(id, silent) {
    const s = sessions().find(x => x.id === id); if (!s || (!silent && !(await ask({ title: 'Delete this session?', ok: 'Delete', danger: true })))) return;
    db.sessions = sessions().filter(x => x.id !== id);
    const d = db.days[s.date]; if (d) d.workouts = d.workouts.filter(w => w.sessionId !== id);
    save(); render(); if (!silent) toast('Session deleted');
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
        <div class="grid-form"><label>Muscles <span class="opt">comma separated</span><input data-f="${i}||tags" value="${esc((d.tags || []).join(', '))}" maxlength="60" placeholder="Chest, Triceps"></label><label>Colour<select data-f="${i}||color">${['Blue', 'Violet', 'Sky', 'Amber', 'Rose', 'Orange'].map((n, k) => `<option value="${k}"${(Number.isInteger(d.color) ? d.color : i) % 6 === k ? ' selected' : ''}>${n}</option>`).join('')}</select></label></div>
        ${d.exercises.map((e, k) => `<div class="exrow"><input data-f="${i}|${k}|name" value="${esc(e.name)}" maxlength="80" placeholder="Exercise" aria-label="Exercise name">
            <div class="exrow-b"><label>Sets<input type="number" min="1" max="20" inputmode="numeric" data-f="${i}|${k}|sets" value="${esc(String(e.sets))}"></label><label>Reps<input data-f="${i}|${k}|reps" value="${esc(e.reps)}" placeholder="12 or 15,12" maxlength="40"></label>
              <label>Type<select data-f="${i}|${k}|kind"><option value="reps"${e.kind === 'reps' ? ' selected' : ''}>Reps</option><option value="time"${e.kind === 'time' ? ' selected' : ''}>Timed</option></select></label></div>
            <input data-f="${i}|${k}|note" value="${esc(e.note || '')}" maxlength="80" placeholder="Note (optional)" aria-label="Note">
            <div class="exrow-c"><button type="button" class="icon-btn sm" data-eact="upex" data-d="${i}" data-e="${k}" aria-label="Move up"${k === 0 ? ' disabled' : ''}>${ico('chev', 'flip')}</button><button type="button" class="icon-btn sm" data-eact="downex" data-d="${i}" data-e="${k}" aria-label="Move down"${k === d.exercises.length - 1 ? ' disabled' : ''}>${ico('chev')}</button><button type="button" class="icon-btn sm" data-eact="delex" data-d="${i}" data-e="${k}" aria-label="Delete exercise">${ico('trash')}</button></div></div>`).join('')}
        <button type="button" class="btn sm" data-eact="addex" data-d="${i}">+ Add exercise</button></div>`).join('')}
      <button type="button" class="btn block" data-eact="addday">+ Add a day</button>
      <div class="card ed-end"><div class="row"><button class="btn primary" data-eact="save">Save plan</button><button class="btn" data-eact="cancel">Cancel</button></div>${canReset() ? '<button type="button" class="btn quiet sm" data-eact="reset">Restore my 6-day plan</button>' : ''}</div>`;
    body.scrollTop = keep;
  }
  function savePlan() {
    for (const d of ED.days) {
      d.name = (d.name || '').trim() || 'Workout';
      d.exercises = d.exercises.filter(e => (e.name || '').trim()).map(e => ({ ...e, name: e.name.trim(), sets: Math.max(1, Math.min(20, Math.round(num(e.sets)) || 1)), reps: String(e.reps || '').trim() || (e.kind === 'time' ? '60 sec' : '10') }));
    }
    db.workout = ED; save(); $('#wk-editor').close(); ED = null; render(); toast('Plan saved');
  }
  async function closeEditor() {
    if (ED && JSON.stringify(ED) !== edBefore && !(await ask({ title: 'Discard changes?', text: 'Your edits to the plan will be lost.', ok: 'Discard', cancel: 'Keep editing', danger: true }))) return;
    $('#wk-editor').close(); ED = null;
  }
  const mv = (a, i, j) => { if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; };

  // ---------- wiring ----------
  document.body.insertAdjacentHTML('beforeend', `
    <dialog id="wk-session" class="sheet" aria-labelledby="ws-title"><div class="sheet-h"><b id="ws-title"></b><button class="icon-btn" data-wk-close="session" aria-label="Close">${ico('close')}</button></div><div class="sheet-body" id="ws-body"></div></dialog>
    <dialog id="wk-pick" class="pick" aria-labelledby="wp-title"><div class="pick-h"><b id="wp-title"></b><button class="icon-btn" data-wp-act="close" aria-label="Close">${ico('close')}</button></div><div id="wp-body"></div></dialog>
    <dialog id="wk-detail" class="sheet" aria-labelledby="wd-title"><div class="sheet-h"><b id="wd-title"></b><button class="icon-btn" data-wd-act="close" aria-label="Close">${ico('close')}</button></div><div class="sheet-body" id="wd-body"></div></dialog>
    <dialog id="wk-editor" class="sheet" aria-labelledby="we-title"><div class="sheet-h"><b id="we-title">Edit workout plan</b><button class="icon-btn" data-eact="cancel" aria-label="Close">${ico('close')}</button></div><div class="sheet-body" id="we-body"></div></dialog>`);
  $('#wk-session').addEventListener('cancel', e => { e.preventDefault(); closeSession(); });
  $('#wk-editor').addEventListener('cancel', e => { e.preventDefault(); closeEditor(); });
  $('#wk-session').addEventListener('close', () => { S0 = null; });
  $('#wk-pick').addEventListener('close', () => { PK = null; });
  $('#wk-detail').addEventListener('close', () => { DT = null; });

  document.addEventListener('click', e => {
    const t = e.target.closest('button,a'); if (!t) return;
    const d = t.dataset;
    if (d.wkStart) { openSession(d.wkStart, d.date || todayISO()); return; }
    if (d.wkOpen) { openDetail(d.wkOpen, d.date || todayISO()); return; }
    if (d.wdAct && DT) {
      const act = d.wdAct, { dayId, date } = DT; $('#wk-detail').close();
      if (act === 'start') openSession(dayId, date); else if (act === 'done') markDone(dayId, date); else if (act === 'change') openPick(date);
      return;
    }
    if (d.wkPick) { openPick(d.wkPick); return; }
    if (d.wkMarkdone) { markDone(d.wkMarkdone, d.date || todayISO()); return; }
    if (d.wkUndo) { deleteSession(d.wkUndo, true); return; }
    if (d.wpSel && PK) { PK.sel = d.wpSel; renderPick(); return; }
    if (d.wpAct && PK) {
      const act = d.wpAct, date = PK.date, sel = PK.sel;
      if (act === 'close') { $('#wk-pick').close(); return; }
      applyPick(); $('#wk-pick').close();
      if (act === 'start') openSession(sel, date); else if (act === 'done') markDone(sel, date); else render();
      return;
    }
    if (d.wkNew !== undefined) { db.workout = { v: 1, rest: [], days: [{ id: nid(), name: 'Day 1', label: '', met: 5, weekday: '', exercises: [E('', 3, 10)], tags: [], color: 0 }] }; save(); openEditor(); render(); return; }
    if (d.wkEdit !== undefined) { openEditor(); return; }
    if (d.wkDelsession) { deleteSession(d.wkDelsession); return; }
    if (d.wkClose === 'session') { closeSession(); return; }
    if (d.wkFinish !== undefined) { finishSession(); return; }
    if (d.wkDiscard !== undefined) { ask({ title: 'Discard this workout?', text: 'Everything you logged in it will be lost.', ok: 'Discard', cancel: 'Keep going', danger: true }).then(ok => { if (ok) { clearDraft(); sessionDirty = false; $('#wk-session').close(); } }); return; }
    if (d.sdone) { const [i, j] = d.sdone.split(':').map(Number), x = S0.logs[i].sets[j]; x.done = !x.done; if (x.done && x.r === '' && S0.logs[i].kind === 'reps') x.r = firstNum(S0.logs[i].target[Math.min(j, S0.logs[i].target.length - 1)]); sessionDirty = true; saveDraft(); renderSession(); return; }
    if (d.sadd !== undefined) { const l = S0.logs[+d.sadd], p = l.sets[l.sets.length - 1]; l.sets.push({ w: p?.w ?? '', r: '', done: false }); l.target.push(l.target[l.target.length - 1]); sessionDirty = true; saveDraft(); renderSession(); return; }
    if (d.sdel !== undefined) { const l = S0.logs[+d.sdel]; if (l.sets.length > 1) { l.sets.pop(); l.target.pop(); sessionDirty = true; saveDraft(); renderSession(); } return; }
    if (d.eact && ED) {
      const a = d.eact, di = +d.d, ei = +d.e;
      if (a === 'save') savePlan();
      else if (a === 'cancel') closeEditor();
      else if (a === 'rest') { const k = +d.wd, i = ED.rest.indexOf(k); i >= 0 ? ED.rest.splice(i, 1) : ED.rest.push(k); renderEditor(); }
      else if (a === 'addday') { ED.days.push({ id: nid(), name: `Day ${ED.days.length + 1}`, label: '', met: 5, weekday: '', exercises: [E('', 3, 10)] }); renderEditor(); }
      else if (a === 'delday') { ask({ title: `Delete "${ED.days[di].name}"?`, text: 'This removes the day and its exercises from your plan.', ok: 'Delete', danger: true }).then(ok => { if (ok && ED) { ED.days.splice(di, 1); renderEditor(); } }); }
      else if (a === 'upday') { mv(ED.days, di, di - 1); renderEditor(); } else if (a === 'downday') { mv(ED.days, di, di + 1); renderEditor(); }
      else if (a === 'addex') { ED.days[di].exercises.push(E('', 3, 10)); renderEditor(); }
      else if (a === 'delex') { ED.days[di].exercises.splice(ei, 1); renderEditor(); }
      else if (a === 'upex') { mv(ED.days[di].exercises, ei, ei - 1); renderEditor(); } else if (a === 'downex') { mv(ED.days[di].exercises, ei, ei + 1); renderEditor(); }
      else if (a === 'reset') { ask({ title: 'Restore your 6-day plan?', text: 'This replaces everything with your 6-day plan. Your logged sessions are kept.', ok: 'Restore' }).then(ok => { if (ok && ED) { ED = seedPlan(); renderEditor(); } }); }
    }
  });
  const onField = e => {
    const t = e.target;
    if (t.dataset.sl && S0) { const [i, j, f] = t.dataset.sl.split(':'); S0.logs[+i].sets[+j][f] = t.value; sessionDirty = true; saveDraft(); return; }
    if (t.dataset.s && S0) { S0[t.dataset.s] = t.value; sessionDirty = true; return; }
    if (t.dataset.f && ED) {
      const [di, ei, f] = t.dataset.f.split('|'), day = ED.days[+di];
      if (ei === '') day[f] = f === 'met' || f === 'color' ? +t.value : f === 'tags' ? t.value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5) : t.value; else day.exercises[+ei][f] = t.value;
    }
  };
  document.addEventListener('input', onField); document.addEventListener('change', onField);
})();

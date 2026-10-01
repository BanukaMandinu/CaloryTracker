'use strict';
/* BM Calory Tracker – all data stays in localStorage. No accounts, no paid APIs. */

// ---------- helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const r0 = n => Math.round(n).toLocaleString();
const r1 = n => (Math.round(n * 10) / 10).toLocaleString();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const isoOf = d => d.toLocaleDateString('en-CA');
const todayISO = () => isoOf(new Date());
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };
const ico = (n, c = '') => `<svg class="i ${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const MEAL_ICON = { Breakfast: 'sunrise', Lunch: 'sun', Dinner: 'moon', Snack: 'cookie' };
const KCAL_PER_KG = 7700;
const STEP_GOAL = 10000;

// nutrient key, label, unit
const NUTR = [['kcal', 'Calories', 'kcal'], ['protein', 'Protein', 'g'], ['carbs', 'Carbs', 'g'], ['fat', 'Fat', 'g'],
  ['fiber', 'Fiber', 'g'], ['sugar', 'Sugar', 'g'], ['satfat', 'Sat. fat', 'g'], ['sodium', 'Sodium', 'mg']];

// MET values: 2011 Compendium of Physical Activities (Ainsworth et al.)
const WORKOUTS = [['Weight training – moderate', 3.5], ['Weight training – vigorous', 6], ['Circuit training', 8], ['HIIT', 8],
  ['Running 8 km/h', 8.3], ['Running 10 km/h', 9.8], ['Running 12 km/h', 11.8], ['Walking brisk 5.5 km/h', 4.3],
  ['Cycling leisure', 4], ['Cycling moderate', 8], ['Cycling vigorous', 10], ['Swimming moderate', 5.8], ['Swimming vigorous', 9.8],
  ['Rowing moderate', 4.8], ['Rowing vigorous', 7], ['Elliptical', 5], ['Stair climber', 9], ['Skipping rope', 11.8],
  ['Boxing / bag work', 5.5], ['Football / soccer', 7], ['Cricket', 4.8], ['Badminton', 5.5], ['Yoga', 2.5]];

// typical single serving in grams (a photo cannot measure portion size, so this is only a starting guess)
const SERV = { 'Chicken breast, cooked': 120, 'Egg, whole boiled': 50, 'Rice, white cooked': 160, 'Rice, brown cooked': 160, 'Oats, dry': 40,
  'Bread, white': 30, 'Bread, wholewheat': 35, 'Roti / chapati': 45, 'Pasta, cooked': 180, 'Potato, boiled': 150, 'Sweet potato, baked': 130,
  'Banana': 118, 'Apple': 180, 'Orange': 130, 'Avocado': 100, 'Milk, whole': 240, 'Milk, skim': 240, 'Greek yogurt, plain 0%': 170,
  'Cheddar cheese': 30, 'Butter': 10, 'Olive oil': 14, 'Salmon, cooked': 120, 'Peanut butter': 32, 'Almonds': 28, 'Pizza': 110,
  'Cheeseburger': 150, 'French fries': 120, 'Fried rice': 200, 'Noodles, cooked': 180, 'Mango': 165, 'Grapes': 100, 'Watermelon': 280,
  'Strawberries': 150, 'Pineapple': 165, 'Papaya': 150, 'Ice cream, vanilla': 100, 'Cake': 80, 'Cookie': 30, 'Salad, mixed greens': 90,
  'Kottu roti, chicken': 350, 'Kottu roti, vegetable': 350, 'Kottu roti, egg': 350, 'Hopper, plain (appa)': 60, 'Hopper, egg': 90,
  'String hoppers (idiyappam)': 100, 'Pittu': 100, 'Kiribath (milk rice)': 120, 'Pol roti': 70, 'Red rice (kekulu), cooked': 160,
  'Rice & curry plate (veg + dhal)': 400, 'Lamprais': 400, 'Pol sambol': 30, 'Lunu miris': 20, 'Seeni sambol': 20, 'Mallum (leaves with coconut)': 60,
  'Jackfruit curry (polos)': 120, 'Potato curry': 120, 'Beetroot curry': 80, 'Chicken curry (Sri Lankan)': 150, 'Fish curry (ambul thiyal)': 100,
  'Egg curry': 120, 'Sambar': 150, 'Dosa (thosai)': 80, 'Idli': 40, 'Vegetable roll / samosa': 60, 'Fish cutlet': 60, 'Fish roll': 100,
  'Paruppu vadai': 40, 'Wattalapam': 100, 'Kavum (oil cake)': 60, 'Kokis': 20, 'Kalu dodol': 40, 'Buffalo curd': 100, 'Coconut milk': 100,
  'King coconut water (thambili)': 300, 'Milk tea with sugar': 200, 'Kola kanda (herbal porridge)': 250,
  'Dhal curry': 150, 'Cola': 330, 'Lentils, cooked': 150, 'Chickpeas, cooked': 150, 'Broccoli, cooked': 90, 'Tofu, firm': 100 };
// extra search words (Sinhala / Sri Lankan spellings and common names)
const ALIAS = { 'Kottu roti, chicken': 'kottu koththu kothu kotthu kotu godamba', 'Kottu roti, vegetable': 'kottu koththu kothu kotthu veg', 'Kottu roti, egg': 'kottu koththu kothu kotthu',
  'Hopper, plain (appa)': 'appa hoppers appam', 'Hopper, egg': 'egg appa bittara appa hoppers', 'String hoppers (idiyappam)': 'indi appa idiyappa string hopper',
  'Kiribath (milk rice)': 'kiri bath milk rice', 'Pol roti': 'coconut roti', 'Red rice (kekulu), cooked': 'kekulu red rice rathu haal', 'Rice, white cooked': 'bath samba nadu rice',
  'Rice & curry plate (veg + dhal)': 'rice and curry bath curry', 'Pol sambol': 'coconut sambol', 'Lunu miris': 'lunumiris onion sambol', 'Seeni sambol': 'onion sambol sini sambol',
  'Mallum (leaves with coconut)': 'mallum gotukola kankun sarana kolla', 'Jackfruit curry (polos)': 'polos kos jak', 'Dhal curry': 'parippu paripu dal dhal lentil',
  'Fish curry (ambul thiyal)': 'malu maalu ambulthiyal sour fish curry', 'Chicken curry (Sri Lankan)': 'kukul mas kukulmas', 'Egg curry': 'biththara bittara kiri hodi',
  'Dosa (thosai)': 'thosai dosai dosa', 'Vegetable roll / samosa': 'samosa rolls short eats', 'Fish cutlet': 'cutlet short eats', 'Fish roll': 'rolls short eats',
  'Paruppu vadai': 'vadai wade vada parippu vadai', 'Kavum (oil cake)': 'kavum konda kavum oil cake', 'Kokis': 'kokis', 'Kalu dodol': 'dodol',
  'Buffalo curd': 'meekiri curd mee kiri yogurt', 'Coconut milk': 'pol kiri kiri', 'King coconut water (thambili)': 'thambili king coconut', 'Milk tea with sugar': 'plain tea kiri thé tea',
  'Kola kanda (herbal porridge)': 'kola kenda kanda porridge', 'Roti / chapati': 'roti chapati godamba roti', 'Coconut, fresh': 'pol coconut', 'Pittu': 'puttu', 'Wattalapam': 'watalappan watalappam pudding' };
// "Rice, white cooked" ->"white cooked rice" (natural phrase for the image model)
const foodLabel = n => n.toLowerCase().replace(/^([^,]+), (.+)$/, '$2 $1').replace(/ \d+%$/, '');

// per 100 g: kcal, protein, carbs, fat, fiber, sugar, sodium(mg), satfat  (approximate USDA-style values)
const FOODS = [
  ['Chicken breast, cooked', 165, 31, 0, 3.6, 0, 0, 74, 1], ['Egg, whole boiled', 155, 13, 1.1, 11, 0, 1.1, 124, 3.3],
  ['Rice, white cooked', 130, 2.7, 28, .3, .4, 0, 1, .1], ['Rice, brown cooked', 123, 2.7, 26, 1, 1.6, .2, 4, .2],
  ['Oats, dry', 389, 17, 66, 7, 10.6, 1, 2, 1.2], ['Bread, white', 265, 9, 49, 3.2, 2.7, 5, 491, .7],
  ['Bread, wholewheat', 247, 13, 41, 3.4, 7, 6, 450, .7], ['Roti / chapati', 297, 9, 46, 8, 4, 2, 400, 3],
  ['Pasta, cooked', 158, 5.8, 31, .9, 1.8, .6, 1, .2], ['Potato, boiled', 87, 1.9, 20, .1, 1.8, .9, 5, 0],
  ['Sweet potato, baked', 90, 2, 21, .2, 3.3, 6.5, 36, 0], ['Banana', 89, 1.1, 23, .3, 2.6, 12, 1, .1],
  ['Apple', 52, .3, 14, .2, 2.4, 10, 1, 0], ['Orange', 47, .9, 12, .1, 2.4, 9, 0, 0], ['Avocado', 160, 2, 8.5, 15, 6.7, .7, 7, 2.1],
  ['Broccoli, cooked', 35, 2.4, 7.2, .4, 3.3, 1.4, 41, .1], ['Carrot, raw', 41, .9, 10, .2, 2.8, 4.7, 69, 0],
  ['Tomato, raw', 18, .9, 3.9, .2, 1.2, 2.6, 5, 0], ['Cucumber', 15, .7, 3.6, .1, .5, 1.7, 2, 0],
  ['Milk, whole', 61, 3.2, 4.8, 3.3, 0, 5.1, 43, 1.9], ['Milk, skim', 34, 3.4, 5, .1, 0, 5, 42, .1],
  ['Greek yogurt, plain 0%', 59, 10, 3.6, .4, 0, 3.2, 36, .1], ['Cheddar cheese', 403, 25, 1.3, 33, 0, .5, 621, 21],
  ['Butter', 717, .9, .1, 81, 0, .1, 11, 51], ['Olive oil', 884, 0, 0, 100, 0, 0, 2, 14],
  ['Salmon, cooked', 206, 22, 0, 12, 0, 0, 61, 2.5], ['Tuna, canned in water', 116, 26, 0, .8, 0, 0, 247, .2],
  ['Beef mince, cooked', 250, 26, 0, 15, 0, 0, 75, 6], ['Tofu, firm', 144, 17, 3, 9, 2.3, .7, 14, 1.3],
  ['Lentils, cooked', 116, 9, 20, .4, 7.9, 1.8, 2, .1], ['Chickpeas, cooked', 164, 8.9, 27, 2.6, 7.6, 4.8, 7, .3],
  ['Almonds', 579, 21, 22, 50, 12.5, 4.4, 1, 3.8], ['Peanut butter', 588, 25, 20, 50, 6, 9, 426, 10],
  ['Coconut, fresh', 354, 3.3, 15, 33, 9, 6, 20, 30], ['Whey protein powder', 400, 80, 8, 6, 0, 4, 300, 3],
  ['Sugar', 387, 0, 100, 0, 0, 100, 1, 0], ['Honey', 304, .3, 82, 0, .2, 82, 4, 0], ['Cola', 42, 0, 10.6, 0, 0, 10.6, 4, 0],
  ['Dark chocolate 70%', 598, 7.8, 46, 43, 11, 24, 20, 25],
  ['Pizza', 266, 11, 33, 10, 2.3, 3.6, 598, 4.5], ['Cheeseburger', 295, 17, 24, 14, 1.3, 6, 500, 6],
  ['French fries', 312, 3.4, 41, 15, 3.8, .3, 210, 2.3], ['Fried rice', 163, 4.2, 25, 5, 1, 1, 300, 1],
  ['Noodles, cooked', 138, 4.5, 25, 2, 1.2, .5, 10, .3], ['Mango', 60, .8, 15, .4, 1.6, 14, 1, .1],
  ['Grapes', 69, .7, 18, .2, .9, 16, 2, .1], ['Watermelon', 30, .6, 7.6, .2, .4, 6.2, 1, 0],
  ['Strawberries', 32, .7, 7.7, .3, 2, 4.9, 1, 0], ['Pineapple', 50, .5, 13, .1, 1.4, 10, 1, 0],
  ['Papaya', 43, .5, 11, .3, 1.7, 7.8, 8, .1], ['Ice cream, vanilla', 207, 3.5, 24, 11, .7, 21, 80, 6.8],
  ['Cake', 350, 5, 55, 13, 1, 35, 300, 3], ['Cookie', 480, 5, 64, 23, 2, 33, 350, 10],
  ['Salad, mixed greens', 17, 1.5, 3, .2, 1.8, 1, 28, 0], ['Dhal curry', 105, 6, 14, 3, 4, 1.5, 200, 1.5],
  // Sri Lankan dishes: approximate typical home / street-food values (recipes vary a lot, so adjust grams)
  ['Kottu roti, chicken', 190, 9, 22, 7, 1.5, 1.5, 450, 2, 'LK'], ['Kottu roti, vegetable', 170, 5, 25, 6, 2, 2, 400, 1.5, 'LK'],
  ['Kottu roti, egg', 185, 8, 22, 8, 1.5, 1.5, 430, 2.2, 'LK'], ['Hopper, plain (appa)', 190, 3, 32, 5, .8, 3, 150, 2.5, 'LK'],
  ['Hopper, egg', 210, 7, 26, 8, .8, 2, 180, 3, 'LK'], ['String hoppers (idiyappam)', 150, 3, 32, .7, 1, 0, 100, .2, 'LK'],
  ['Pittu', 165, 3, 32, 2, 2, 0, 50, 1.5, 'LK'], ['Kiribath (milk rice)', 170, 3, 27, 5, .5, 0, 60, 3.5, 'LK'],
  ['Pol roti', 240, 5, 38, 8, 3, 1, 300, 5, 'LK'], ['Red rice (kekulu), cooked', 111, 2.3, 23, .8, 1.8, .2, 3, .2, 'LK'],
  ['Rice & curry plate (veg + dhal)', 140, 4, 22, 4, 2.5, 1, 200, 2, 'LK'], ['Lamprais', 200, 8, 25, 8, 1.5, 1, 400, 3, 'LK'],
  ['Pol sambol', 250, 2.5, 10, 23, 5, 3, 250, 20, 'LK'], ['Lunu miris', 60, 1.5, 8, 2.5, 3, 3, 400, .5, 'LK'],
  ['Seeni sambol', 200, 2, 25, 10, 3, 17, 350, 6, 'LK'], ['Mallum (leaves with coconut)', 110, 3, 8, 8, 4, 1, 100, 6, 'LK'],
  ['Jackfruit curry (polos)', 90, 2, 15, 3, 3, 3, 200, 2.5, 'LK'], ['Potato curry', 90, 1.5, 14, 3.5, 1.8, 2, 250, 2.5, 'LK'],
  ['Beetroot curry', 60, 1.5, 9, 2, 2, 6, 250, 1.5, 'LK'], ['Chicken curry (Sri Lankan)', 150, 14, 4, 9, 1, 1, 400, 4, 'LK'],
  ['Fish curry (ambul thiyal)', 130, 20, 2, 5, .3, .5, 450, 1.2, 'LK'], ['Egg curry', 135, 8, 4, 9.5, .5, 1.5, 350, 3, 'LK'],
  ['Sambar', 60, 3, 9, 1.5, 2, 2, 300, .3, 'LK'], ['Dosa (thosai)', 165, 4, 26, 5, 1, 1, 300, 1, 'LK'], ['Idli', 130, 4, 26, .5, 1, .3, 200, .1, 'LK'],
  ['Vegetable roll / samosa', 260, 5, 26, 15, 2, 1, 400, 3, 'LK'], ['Fish cutlet', 220, 10, 20, 11, 1.5, 1, 450, 2, 'LK'],
  ['Fish roll', 250, 8, 26, 13, 1.5, 1, 400, 4, 'LK'], ['Paruppu vadai', 330, 13, 30, 17, 6, 1, 350, 3, 'LK'],
  ['Wattalapam', 190, 4, 26, 8, .3, 24, 90, 6, 'LK'], ['Kavum (oil cake)', 400, 4, 55, 19, 1, 25, 60, 4, 'LK'],
  ['Kokis', 480, 6, 55, 26, 1, 7, 80, 8, 'LK'], ['Kalu dodol', 380, 2, 80, 7, 1, 50, 30, 6, 'LK'],
  ['Buffalo curd', 120, 4, 5, 9, 0, 5, 45, 6, 'LK'], ['Coconut milk', 197, 2, 3, 21, .5, 3, 15, 19, 'LK'],
  ['King coconut water (thambili)', 19, .2, 3.7, .2, 0, 3.5, 105, 0, 'LK'], ['Milk tea with sugar', 30, .8, 5, .8, 0, 5, 10, .5, 'LK'],
  ['Kola kanda (herbal porridge)', 60, 1, 10, 2, 1, 0, 100, 1.5, 'LK']
].map(f => ({ name: f[0], serving: SERV[f[0]] || 100, label: foodLabel(f[0]), src: f[9] === 'LK' ? 'Sri Lankan, approx.' : 'built-in', per100: { kcal: f[1], protein: f[2], carbs: f[3], fat: f[4], fiber: f[5], sugar: f[6], sodium: f[7], satfat: f[8] } }));

// ---------- storage ----------
const KEY = 'bmct.v1';
const DEFAULTS = () => ({
  settings: { sex: 'male', age: 30, heightCm: 175, weightKg: 75, bodyFat: '', waist: '', neck: '', hip: '', goalWeight: '', goalDate: '',
    startWeight: '', baseline: 1.2, proteinPerKg: 1.8, fatPct: 28, stepLenCm: '' },
  days: {}, weights: {}, recent: []
});
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && typeof raw === 'object') { const d = DEFAULTS(); return { ...d, ...raw, settings: { ...d.settings, ...(raw.settings || {}) } }; }
  } catch { /* corrupted or blocked storage */ }
  return DEFAULTS();
}
let db = load();
let storageOK = true;
function save(push = true) {
  db.updated = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch { if (storageOK) { storageOK = false; toast('Storage unavailable: data will be lost on close. Export a backup.'); } }
  if (push && user) schedulePush();
}
let cur = todayISO();
const day = (d = cur) => (db.days[d] ||= { foods: [], steps: 0, workouts: [] });

// ---------- science ----------
const S = () => db.settings;
function curWeight() {
  const ds = Object.keys(db.weights).sort();
  return ds.length ? db.weights[ds[ds.length - 1]] : num(S().weightKg);
}
const bmi = (w = curWeight()) => { const h = num(S().heightCm) / 100; return h ? w / (h * h) : 0; };
const bmiCat = b => b < 18.5 ? 'Underweight' : b < 25 ? 'Healthy' : b < 30 ? 'Overweight' : 'Obese';

function navyBF() {
  const s = S(), h = num(s.heightCm), w = num(s.waist), n = num(s.neck), hip = num(s.hip);
  if (!h || !w || !n) return null;
  if (s.sex === 'male') return w > n ? 495 / (1.0324 - 0.19077 * Math.log10(w - n) + 0.15456 * Math.log10(h)) - 450 : null;
  return hip && w + hip > n ? 495 / (1.29579 - 0.35004 * Math.log10(w + hip - n) + 0.221 * Math.log10(h)) - 450 : null;
}
function bodyFat() {
  const s = S(), clamp = v => Math.min(60, Math.max(2, v));
  if (num(s.bodyFat) > 0) return { v: num(s.bodyFat), src: 'Measured' };
  const n = navyBF();
  if (n !== null && Number.isFinite(n)) return { v: clamp(n), src: 'US Navy method' };
  return { v: clamp(1.2 * bmi() + .23 * num(s.age) - 10.8 * (s.sex === 'male' ? 1 : 0) - 5.4), src: 'Deurenberg estimate' };
}
function bmr() {
  const s = S(), w = curWeight();
  if (num(s.bodyFat) > 0) return { v: 370 + 21.6 * w * (1 - num(s.bodyFat) / 100), f: 'Katch-McArdle' };
  return { v: 10 * w + 6.25 * num(s.heightCm) - 5 * num(s.age) + (s.sex === 'male' ? 5 : -161), f: 'Mifflin-St Jeor' };
}
const stepLenM = () => (num(S().stepLenCm) || num(S().heightCm) * (S().sex === 'male' ? .415 : .413)) / 100;
const stepsKcal = steps => .5 * curWeight() * steps * stepLenM() / 1000; // 0.5 kcal/kg/km net walking cost
const workoutKcal = (met, min) => (met - 1) * curWeight() * min / 60;

function totals(d = cur) {
  const t = Object.fromEntries(NUTR.map(n => [n[0], 0]));
  (db.days[d]?.foods || []).forEach(f => NUTR.forEach(n => t[n[0]] += num(f[n[0]])));
  return t;
}
function expenditure(d = cur) {
  const dd = db.days[d] || { steps: 0, workouts: [] };
  const base = bmr().v * num(S().baseline);
  const st = stepsKcal(num(dd.steps));
  const wk = dd.workouts.reduce((a, w) => a + num(w.kcal), 0);
  return { base, steps: st, workouts: wk, total: base + st + wk };
}
function plan() {
  const s = S(); if (!num(s.goalWeight) || !s.goalDate) return null;
  const w = curWeight(), goal = num(s.goalWeight);
  const days = Math.ceil((new Date(s.goalDate + 'T12:00:00') - new Date(todayISO() + 'T12:00:00')) / 864e5);
  if (days <= 0) return { expired: true };
  const diff = w - goal; // >0 lose, <0 gain
  const deficit = diff * KCAL_PER_KG / days;
  const perWeek = diff / days * 7;
  const warns = [];
  if (Math.abs(perWeek) > .01 * w) warns.push(`That is ${r1(Math.abs(perWeek))} kg/week, more than ~1% of body weight per week. Consider a later date.`);
  if (deficit > 1000) warns.push('A deficit above 1,000 kcal/day risks muscle loss and nutrient shortfalls.');
  return { days, diff, deficit, perWeek, warns, goal };
}
function budget() {
  const e = expenditure().total, p = plan();
  const kcal = p && !p.expired ? e - p.deficit : e;
  return { kcal, deficit: p && !p.expired ? p.deficit : 0, e };
}
function targets() {
  const b = budget().kcal, w = curWeight(), s = S();
  const protein = num(s.proteinPerKg) * w, fat = Math.max(.6 * w, b * num(s.fatPct) / 100 / 9);
  const carbs = Math.max(0, (b - protein * 4 - fat * 9) / 4);
  return { kcal: b, protein, fat, carbs, fiber: 14 * b / 1000, sugar: b * .10 / 4, satfat: b * .10 / 9, sodium: 2000 };
}

// ---------- ui plumbing ----------
let toastT, undoFn = null;
function toast(msg, undo) {
  const t = $('#toast'); $('#toast-t').textContent = msg; undoFn = undo || null; $('#toast-undo').hidden = !undo;
  t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), undo ? 6000 : 2600);
}
$('#toast-undo').onclick = () => { const f = undoFn; undoFn = null; $('#toast').classList.remove('on'); f?.(); };
const mealOptions = sel => MEALS.map(m => `<option${m === sel ? ' selected' : ''}>${m}</option>`).join('');
const defaultMeal = () => { const h = new Date().getHours(); return h < 11 ? 'Breakfast' : h < 15 ? 'Lunch' : h < 21 ? 'Dinner' : 'Snack'; };
let addMeal = defaultMeal();
let view = 'today';
function go(v) {
  if (!$('#view-' + v)) v = 'today';
  if (view === 'add' && v !== 'add') stopScan();
  view = v;
  $$('.view').forEach(e => e.classList.toggle('on', e.id === 'view-' + v));
  $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.view === v || a.dataset.also === v));
  if (v === 'add') showTab('home');
  render(); window.scrollTo(0, 0);
}
function renderDayStrip() {
  const t = todayISO(), el = $('#datenav'), days = Array.from({ length: 21 }, (_, i) => addDays(t, i - 20));
  el.innerHTML = days.map(d => {
    const dt = new Date(d + 'T12:00:00'), x = db.days[d], has = x && (x.foods.length || x.steps || x.workouts.length);
    return `<button class="dpill${d === cur ? ' on' : ''}" data-day="${d}" aria-label="${dt.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}${d === t ? ' (today)' : ''}" aria-pressed="${d === cur}"><small>${d === t ? 'Today' : dt.toLocaleDateString(undefined, { weekday: 'short' })}</small><b>${dt.getDate()}</b><i class="${has ? 'has' : ''}"></i></button>`;
  }).join('');
  const on = el.querySelector('.on'); if (on) el.scrollLeft = on.offsetLeft - el.clientWidth / 2 + on.offsetWidth / 2;
}
function render() {
  $('#datenav').hidden = !['today', 'add', 'activity'].includes(view);
  if (!$('#datenav').hidden) renderDayStrip();
  ({ today: renderToday, history: renderHistory, activity: renderActivity, progress: renderProgress, settings: renderSettings, add: renderAdd }[view] || (() => { }))();
}
const ptabs = a => `<nav class="ptabs" aria-label="Progress sections"><a href="#progress" class="${a === 'progress' ? 'on' : ''}">Overview</a><a href="#history" class="${a === 'history' ? 'on' : ''}">Diary</a></nav>`;

// ---------- views ----------
function bar(label, val, target, unit, color, limit) {
  const pct = target ? Math.min(100, val / target * 100) : 0, over = target && val > target;
  return `<div class="bar${limit && over ? ' over' : ''}" style="--c:${color}"><div class="h"><span>${label}</span><span>${r0(val)} / ${r0(target)} ${unit}${limit ? ' max' : ''}</span></div><div class="t"><i style="width:${pct}%"></i></div></div>`;
}
function macroBar(label, val, target, color) {
  const pct = target ? Math.min(100, val / target * 100) : 0, left = Math.max(0, target - val);
  return `<div class="mbar" style="--c:${color}"><div class="h"><b>${label}</b><span><em>${r0(val)}</em> / ${r0(target)} g · ${r0(left)} g left</span></div><div class="t"><i style="width:${pct}%"></i></div></div>`;
}
function verdictText(t, e, b, bal) {
  const isToday = cur === todayISO(), word = isToday ? 'so far today' : 'that day';
  if (!t.kcal) return { cls: '', icon: 'info', head: isToday ? 'Nothing logged yet' : 'Nothing logged that day', sub: isToday ? 'Tap the orange + to add your first meal.' : 'Use Add food to log meals for this day.' };
  if (bal <= 0) return { cls: '', icon: 'check', head: `${r0(-bal)} kcal under what you burned`, sub: `A calorie deficit ${word}: about ${r1(-bal / KCAL_PER_KG * 1000)} g of body weight if every day looked like this.` };
  return { cls: 'warn', icon: 'info', head: `${r0(bal)} kcal over what you burned`, sub: `A calorie surplus ${word}: about ${r1(bal / KCAL_PER_KG * 1000)} g of body weight if every day looked like this.` };
}
function renderToday() {
  const t = totals(), e = expenditure(), b = budget(), tg = targets(), bal = t.kcal - e.total;
  const R = 70, C = 2 * Math.PI * R, pct = b.kcal > 0 ? Math.min(1, t.kcal / b.kcal) : 0;
  const bf = bodyFat(), bm = bmi(), left = b.kcal - t.kcal, v = verdictText(t, e, b, bal);
  const foods = day().foods, dd = day();
  const meals = MEALS.map(m => {
    const fs = foods.filter(f => f.meal === m), kc = fs.reduce((a, f) => a + num(f.kcal), 0);
    return `<div class="card meal"><div class="meal-h"><span class="meal-ico">${ico(MEAL_ICON[m])}</span><b>${m}<small>${fs.length ? `${fs.length} item${fs.length > 1 ? 's' : ''} · ${r0(kc)} kcal` : 'Nothing yet'}</small></b><a class="addmini" href="#add" data-addmeal="${m}" aria-label="Add food to ${m}">${ico('plus')}</a></div>` +
      (fs.length ? `<div class="list">${fs.map(f => `<div class="item"><div class="n"><b>${esc(f.name)}</b><span>${f.grams ? r0(f.grams) + ' g · ' : ''}P ${r0(f.protein)} · C ${r0(f.carbs)} · F ${r0(f.fat)} g</span></div><div class="k">${r0(f.kcal)}<small>kcal</small></div><button class="icon-btn sm" data-del-food="${f.id}" aria-label="Delete ${esc(f.name)}">${ico('trash')}</button></div>`).join('')}</div>` : '') + '</div>';
  }).join('');
  $('#view-today').innerHTML = `
  <div class="card hero-card">
    <div class="hero">
      <div class="ring"><svg width="168" height="168" viewBox="0 0 168 168" aria-hidden="true"><circle class="rt" cx="84" cy="84" r="${R}"/><circle class="ra${left < 0 ? ' over' : ''}" cx="84" cy="84" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/></svg>
        <div class="c"><b>${r0(Math.abs(left))}</b><span>${left < 0 ? 'kcal over budget' : 'kcal left to eat'}</span></div></div>
      <div class="hstats">
        <div class="hstat"><span>Eaten</span><b>${r0(t.kcal)}</b></div>
        <div class="hstat"><span>Burned</span><b>${r0(e.total)}</b></div>
        <div class="hstat"><span>${b.deficit ? 'Goal budget' : 'Budget'}</span><b>${r0(b.kcal)}</b></div>
      </div>
    </div>
    <div class="breakdown" aria-label="How burned calories add up"><span><b>${r0(e.base)}</b>maintenance</span><i>+</i><span><b>${r0(e.steps)}</b>steps</span><i>+</i><span><b>${r0(e.workouts)}</b>workouts</span><i>=</i><span><b>${r0(e.total)}</b>burned</span></div>
    <div class="verdict ${v.cls}">${ico(v.icon)}<div><b>${v.head}</b><span>${v.sub}</span></div></div>
    <details><summary>How is this worked out?</summary>
      <p><b>Maintenance</b> (${r0(e.base)} kcal) is your resting burn multiplied by your daily activity level (${r1(num(S().baseline))}×, set in Profile). Steps and workouts you log are added on top, so burned (and your budget) rises through the day. A deficit looks big early on, until you have eaten and logged your activity.</p>
      <p>${b.deficit ? `Your budget is what you burn minus the ${r0(b.deficit)} kcal daily deficit needed to hit your goal.` : 'Add a goal weight and date in Profile and the budget will aim you at it.'}</p>
    </details>
  </div>

  ${meals}

  <div class="card"><h2>Macros</h2>
    <div class="mbars">${macroBar('Protein', t.protein, tg.protein, 'var(--protein)')}${macroBar('Carbs', t.carbs, tg.carbs, 'var(--carbs)')}${macroBar('Fat', t.fat, tg.fat, 'var(--fat)')}</div>
    <details class="more" style="margin-top:1rem"><summary>More nutrients</summary>
      ${bar('Fiber', t.fiber, tg.fiber, 'g', 'var(--accent)')}${bar('Sugar', t.sugar, tg.sugar, 'g', 'var(--warn)', 1)}${bar('Sat. fat', t.satfat, tg.satfat, 'g', 'var(--warn)', 1)}${bar('Sodium', t.sodium, tg.sodium, 'mg', 'var(--warn)', 1)}
    </details>
  </div>

  <div class="card"><h2>Move</h2>
    <div class="chipstats">
      <a class="cs" href="#activity"><b>${dd.steps ? r0(dd.steps) : '0'}</b><span>steps</span></a>
      <a class="cs" href="#activity"><b>${r0(e.workouts)}</b><span>workout kcal</span></a>
      <a class="cs" href="#activity"><b>${dd.workouts.length}</b><span>workouts</span></a>
    </div>
  </div>

  <div class="card"><h2>Body</h2>
    <div class="chipstats">
      <a class="cs" href="#progress"><b>${r1(curWeight())}<small> kg</small></b><span>weight</span></a>
      <a class="cs" href="#settings"><b>${r1(bm)}</b><span>BMI · ${bmiCat(bm)}</span></a>
      <a class="cs" href="#settings"><b>${r1(bf.v)}%</b><span>body fat</span></a>
    </div>
  </div>`;
}

function renderActivity() {
  const dd = day(), e = expenditure();
  $('#steps-input').value = dd.steps || '';
  $('#steps-note').textContent = dd.steps ? `${r0(dd.steps)} steps ≈ ${r1(dd.steps * stepLenM() / 1000)} km ≈ ${r0(e.steps)} kcal (step length ${r0(stepLenM() * 100)} cm).` : 'Enter the total from your phone or watch.';
  $('#steps-bar').style.width = Math.min(100, num(dd.steps) / STEP_GOAL * 100) + '%';
  $('#steps-goal').textContent = `${r0(num(dd.steps))} / ${r0(STEP_GOAL)}`;
  $('#act-summary').innerHTML = `<div class="card"><h2>Energy burned today</h2><div class="stats"><div class="stat"><b>${r0(e.base)}</b><span>Resting + daily life</span></div><div class="stat"><b>${r0(e.steps)}</b><span>Steps</span></div><div class="stat"><b>${r0(e.workouts)}</b><span>Workouts</span></div></div><p class="muted small">Total ${r0(e.total)} kcal</p></div>`;
  $('#workout-list').innerHTML = dd.workouts.length ? dd.workouts.map(w => `<div class="item"><div class="n"><b>${esc(w.type)}</b><span>${w.cat === 'gym' ? 'Gym' : 'Extra'} · ${w.min} min${w.note ? ' · ' + esc(w.note) : ''}</span></div><div class="k">${r0(w.kcal)} kcal</div><button class="icon-btn sm" data-del-w="${w.id}" aria-label="Delete workout">${ico('trash')}</button></div>`).join('') : `<div class="empty">${ico('flame')}<p>No workouts logged.</p></div>`;
  updateWorkoutPreview();
}
function updateWorkoutPreview() {
  const f = $('#workout-form'), met = WORKOUTS[$('#w-type').selectedIndex]?.[1] || 0, min = num(f.min.value);
  $('#w-preview').textContent = f.kcal.value ? `Using your figure: ${r0(num(f.kcal.value))} kcal.` : `Estimate: ${r0(workoutKcal(met, min))} kcal (MET ${met} at ${r1(curWeight())} kg).`;
}

function barsChart() {
  const ds = Array.from({ length: 14 }, (_, i) => addDays(todayISO(), i - 13));
  const data = ds.map(d => ({ d, i: totals(d).kcal, e: expenditure(d).total, has: !!db.days[d]?.foods.length }));
  const max = Math.max(500, ...data.map(x => Math.max(x.i, x.e))) * 1.1, W = 600, H = 190, bw = W / 14;
  const y = v => H - 20 - v / max * (H - 30);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Calories eaten versus burned, last 14 days">` +
    [0, .5, 1].map(f => `<line x1="0" x2="${W}" y1="${y(max * f / 1.1)}" y2="${y(max * f / 1.1)}" stroke="var(--line)"/><text x="2" y="${y(max * f / 1.1) - 3}">${r0(max * f / 1.1)}</text>`).join('') +
    data.map((x, k) => `<rect x="${k * bw + 6}" y="${y(x.e)}" width="${bw / 2 - 6}" height="${H - 20 - y(x.e)}" rx="3" fill="var(--line)"/>` +
      (x.has ? `<rect x="${k * bw + bw / 2}" y="${y(x.i)}" width="${bw / 2 - 6}" height="${H - 20 - y(x.i)}" rx="3" fill="${x.i <= x.e ? 'var(--accent)' : 'var(--warn)'}"/>` : '') +
      `<text x="${k * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${x.d.slice(8)}</text>`).join('') + '</svg>' +
    '<div class="legend"><span><i style="background:var(--line)"></i>Burned</span><span><i style="background:var(--accent)"></i>Eaten (deficit)</span><span><i style="background:var(--warn)"></i>Eaten (surplus)</span></div>';
}
function weightChart() {
  const es = Object.entries(db.weights).sort().slice(-60);
  if (es.length < 2) return '<p class="empty">Log your weight on at least two days to see the trend.</p>';
  const goal = num(S().goalWeight), vals = es.map(e => e[1]).concat(goal ? [goal] : []);
  const lo = Math.min(...vals) - 1, hi = Math.max(...vals) + 1, W = 600, H = 180;
  const x = i => 30 + i / (es.length - 1) * (W - 40), y = v => H - 20 - (v - lo) / (hi - lo) * (H - 35);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight trend">` +
    [lo, (lo + hi) / 2, hi].map(v => `<line x1="30" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="0" y="${y(v) + 3}">${r1(v)}</text>`).join('') +
    (goal ? `<line x1="30" x2="${W}" y1="${y(goal)}" y2="${y(goal)}" stroke="var(--good)" stroke-dasharray="5 4"/><text x="${W - 60}" y="${y(goal) - 4}" style="fill:var(--good)">goal ${r1(goal)}</text>` : '') +
    `<polyline fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" points="${es.map((e, i) => x(i) + ',' + y(e[1])).join(' ')}"/>` +
    es.map((e, i) => `<circle cx="${x(i)}" cy="${y(e[1])}" r="3" fill="var(--accent)"><title>${e[0]}: ${e[1]} kg</title></circle>`).join('') +
    `<text x="30" y="${H - 4}">${es[0][0]}</text><text x="${W - 70}" y="${H - 4}">${es[es.length - 1][0]}</text></svg>`;
}
function renderProgress() {
  $('#ptabs').innerHTML = ptabs('progress');
  $('#weight-input').value = db.weights[cur] || '';
  const p = plan(), w = curWeight(), s = S();
  let goal = '<p class="muted">Set a goal weight and date in Settings.</p>';
  if (p?.expired) goal = '<p class="warn">Your goal date has passed. Set a new date in Settings.</p>';
  else if (p) {
    const start = num(s.startWeight) || w, tot = start - p.goal;
    const prog = tot ? Math.min(100, Math.max(0, (start - w) / tot * 100)) : 100;
    goal = `<div class="stats"><div class="stat"><b>${r1(w)} → ${r1(p.goal)}</b><span>kg</span></div><div class="stat"><b>${p.days}</b><span>days left</span></div><div class="stat"><b>${r0(Math.abs(p.deficit))}</b><span>kcal/day ${p.deficit >= 0 ? 'deficit' : 'surplus'}</span></div></div>
      <div class="bar" style="--c:var(--accent)"><div class="h"><span>Progress</span><span>${r0(prog)}%</span></div><div class="t"><i style="width:${prog}%"></i></div></div>
      <p class="small">Needed pace: ${r1(Math.abs(p.perWeek))} kg/week ${p.perWeek >= 0 ? 'loss' : 'gain'}.</p>${p.warns.map(x => `<div class="note">⚠ ${esc(x)}</div>`).join('')}`;
    const tg = targets(); if (tg.kcal < bmr().v) goal += `<div class="note">⚠ Today's calorie budget (${r0(tg.kcal)}) is below your BMR (${r0(bmr().v)}). Discuss very-low-calorie plans with a clinician.</div>`;
  }
  const logged = Object.keys(db.days).filter(d => db.days[d].foods.length && d < todayISO() || d === todayISO() && db.days[d]?.foods.length).sort().slice(-7);
  let trend = '<p class="muted small">Log food for a few days to see your average balance and projection.</p>';
  if (logged.length) {
    const avg = logged.reduce((a, d) => a + totals(d).kcal - expenditure(d).total, 0) / logged.length, perWeek = avg * 7 / KCAL_PER_KG;
    trend = `<p><b>${r0(Math.abs(avg))} kcal/day ${avg <= 0 ? 'deficit' : 'surplus'}</b> over the last ${logged.length} logged day(s) ≈ ${r1(Math.abs(perWeek))} kg/week ${avg <= 0 ? 'loss' : 'gain'}.</p>`;
    if (p && !p.expired && p.diff !== 0 && (avg < 0) === (p.diff > 0) && Math.abs(avg) > 20) {
      const d = Math.ceil(Math.abs(p.diff) * KCAL_PER_KG / Math.abs(avg));
      trend += `<p class="small muted">At this pace you would reach ${r1(p.goal)} kg around <b>${new Date(Date.now() + d * 864e5).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</b>.</p>`;
    }
  }
  $('#progress-body').innerHTML = `<div class="card"><h2>Goal</h2>${goal}</div><div class="card"><h2>Last 14 days</h2>${barsChart()}${trend}</div><div class="card"><h2>Weight</h2>${weightChart()}</div>`;
}

function fillSettings() {
  const s = S(), set = (id, v) => $('#' + id).value = v ?? '';
  set('s-sex', s.sex); set('s-age', s.age); set('s-height', s.heightCm); set('s-weight', curWeight()); set('s-bf', s.bodyFat);
  set('s-waist', s.waist); set('s-neck', s.neck); set('s-hip', s.hip); set('s-goal', s.goalWeight); set('s-goaldate', s.goalDate);
  set('s-base', s.baseline); set('s-steplen', s.stepLenCm); set('s-ppk', s.proteinPerKg); set('s-fatpct', s.fatPct);
}
function renderSettings() {
  const bf = bodyFat(), b = bmr(), bm = bmi();
  $('#derived').innerHTML = [[r1(bm), 'BMI · ' + bmiCat(bm)], [r1(bf.v) + '%', 'Body fat · ' + bf.src], [r0(b.v), 'BMR kcal · ' + b.f], [r0(b.v * num(S().baseline)), 'Maintenance at rest-day baseline']]
    .map(x => `<div class="stat"><b>${x[0]}</b><span>${x[1]}</span></div>`).join('');
}

// ---------- adding food ----------
function addFood(entry) {
  const f = { id: uid(), ...entry };
  day().foods.push(f);
  db.recent = [{ ...entry }, ...db.recent.filter(r => r.name !== entry.name)].slice(0, 25);
  save(); render(); toast(`Added ${entry.name} (${r0(entry.kcal)} kcal)`);
}
let pending = null;
function openPicker(item) {
  pending = item;
  $('#picker-title').textContent = item.name;
  $('#picker-sub').textContent = `Per 100 g: ${r0(item.per100.kcal)} kcal · P ${r1(item.per100.protein)} · C ${r1(item.per100.carbs)} · F ${r1(item.per100.fat)} g · ${item.src}`;
  $('#picker-grams').value = item.serving || 100;
  $('#picker-meal').innerHTML = mealOptions(addMeal);
  const sv = item.serving || 100;
  $('#picker-quick').innerHTML = [[.5, '½'], [1, '1×'], [1.5, '1½'], [2, '2×']].map(([m, l]) => `<button type="button" class="chipbtn" data-grams="${Math.round(sv * m)}">${l} · ${Math.round(sv * m)} g</button>`).join('');
  updatePicker(); $('#picker').showModal();
}
const scaled = (item, g) => Object.fromEntries(NUTR.map(n => [n[0], (item.per100[n[0]] || 0) * g / 100]));
function updatePicker() {
  const s = scaled(pending, num($('#picker-grams').value));
  $('#picker-preview').innerHTML = `<div class="mp big"><b>${r0(s.kcal)}</b><span>kcal</span></div>` + [['Protein', 'protein'], ['Carbs', 'carbs'], ['Fat', 'fat']].map(([l, k]) => `<div class="mp"><b>${r1(s[k])}</b><span>${l} g</span></div>`).join('');
}
// spelling-tolerant matching: "koththu" = "kottu" = "kothu"
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/(.)\1+/g, '$1').replace(/h/g, '');
function searchLocal(q) {
  const w = norm(q).split(/\s+/).filter(Boolean);
  return FOODS.filter(f => { const h = f.hay ||= norm(f.name + ' ' + (ALIAS[f.name] || '')); return w.every(x => h.includes(x)); });
}
function fromOFF(p) {
  const n = p.nutriments || {};
  const kcal = n['energy-kcal_100g'] ?? (n.energy_100g ? n.energy_100g / 4.184 : null);
  if (!p.product_name || kcal == null) return null;
  const sod = n.sodium_100g != null ? n.sodium_100g * 1000 : (n.salt_100g != null ? n.salt_100g * 400 : 0);
  const brand = (Array.isArray(p.brands) ? p.brands.join(',') : String(p.brands || '')).split(',')[0].trim();
  return { name: p.product_name + (brand ? ` (${brand})` : ''), src: 'Open Food Facts', serving: Math.round(num(p.serving_quantity)) || 100,
    per100: { kcal, protein: n.proteins_100g || 0, carbs: n.carbohydrates_100g || 0, fat: n.fat_100g || 0, fiber: n.fiber_100g || 0, sugar: n.sugars_100g || 0, satfat: n['saturated-fat_100g'] || 0, sodium: sod } };
}
const OFF = 'https://world.openfoodfacts.org';
async function lookupBarcode(code) {
  code = String(code).replace(/\D/g, ''); const st = $('#scan-status');
  if (code.length < 6) { st.textContent = 'That does not look like a barcode.'; return; }
  st.textContent = `Looking up ${code}…`;
  try {
    const r = await fetch(`${OFF}/api/v2/product/${code}.json?fields=product_name,brands,nutriments,serving_quantity`);
    const j = await r.json(), item = j.status === 1 ? fromOFF(j.product) : null;
    if (item) { st.textContent = 'Found.'; openPicker(item); }
    else st.textContent = `Barcode ${code} is not in the database (or has no nutrition data). Try Search or Enter manually.`;
  } catch { st.textContent = 'Lookup failed. Check your connection, or use Search / Enter manually.'; }
}
// Online search: our own proxy first (fast, no CORS problems once deployed), then Open Food Facts directly.
async function searchOnline(q) {
  const get = async url => { const c = new AbortController(), t = setTimeout(() => c.abort(), 9000); try { const r = await fetch(url, { signal: c.signal }); if (!r.ok) throw 0; return await r.json(); } finally { clearTimeout(t); } };
  let j;
  try { j = await get(`/api/foods?q=${encodeURIComponent(q)}`); }
  catch { j = await get(`${OFF}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=15&fields=product_name,brands,nutriments,serving_quantity`); }
  return (j.products || []).map(fromOFF).filter(Boolean);
}
let searchSeq = 0;
function showRecent() {
  const box = $('#search-results'); ++searchSeq; box._items = [];
  box.innerHTML = db.recent.length
    ? '<h3>Recent foods</h3>' + db.recent.slice(0, 12).map((r, i) => `<div class="item"><div class="n"><b>${esc(r.name)}</b><span>${r0(r.kcal)} kcal · P ${r0(r.protein)} · C ${r0(r.carbs)} · F ${r0(r.fat)} g</span></div><button class="btn sm primary" data-re="${i}" aria-label="Add ${esc(r.name)} again">Add</button></div>`).join('')
    : `<div class="empty">${ico('utensils')}<p><b>Search to get started</b><br>Try “kottu”, “rice” or “banana”. Foods you add will be saved here for one-tap logging.</p></div>`;
}
async function searchFoods(q) {
  if (!q) return showRecent();
  const seq = ++searchSeq, box = $('#search-results'), local = searchLocal(q);
  const render = (items, note = '') => {
    box._items = items;
    box.innerHTML = (items.length ? items.map((it, i) => `<div class="item"><div class="n"><b>${esc(it.name)}</b><span>${r0(it.per100.kcal)} kcal/100 g${it.serving !== 100 ? ` · ${r0(it.per100.kcal * it.serving / 100)} kcal per ${it.serving} g` : ''} · ${esc(it.src)}</span></div><button class="btn sm primary" data-pick="${i}">Add</button></div>`).join('')
      : `<div class="empty">${ico('search')}<p>No built-in match.</p></div>`) + note;
  };
  render(local, q.length > 1 ? '<p class="muted small" id="s-load">Searching packaged foods online…</p>' : '');
  if (q.length < 2) return;
  try {
    const online = await searchOnline(q); if (seq !== searchSeq) return;
    const seen = new Set(local.map(f => f.name.toLowerCase()));
    render(local.concat(online.filter(o => !seen.has(o.name.toLowerCase()))), online.length ? '' : '<p class="muted small">No online matches. Try another spelling, or use Manual.</p>');
  } catch { if (seq === searchSeq) render(local, '<p class="muted small">Online search unavailable right now. Showing built-in foods only.</p>'); }
}

// ---------- barcode scanner (free, on-device) ----------
let stream = null, timer = null, zx = null;
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];
function loadZX() {
  return window.ZXing ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'vendor/zxing.min.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
}
async function startScan() {
  const st = $('#scan-status');
  if (!navigator.mediaDevices?.getUserMedia) { st.textContent = 'Camera access needs HTTPS. It works on your deployed Cloudflare URL or localhost.'; return; }
  stopScan(); st.textContent = 'Starting camera…';
  try {
    $('#scanbox').hidden = false; $('#scan-start').hidden = true; $('#scan-stop').hidden = false;
    if ('BarcodeDetector' in window) {
      const det = new BarcodeDetector({ formats: FORMATS }), v = $('#scan-video');
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      v.srcObject = stream; await v.play();
      timer = setInterval(async () => { try { const r = await det.detect(v); if (r.length) onCode(r[0].rawValue); } catch { } }, 300);
    } else {
      await loadZX(); zx = new ZXing.BrowserMultiFormatReader();
      zx.decodeFromVideoDevice(null, 'scan-video', res => { if (res) onCode(res.getText()); });
    }
    st.textContent = 'Point at a barcode and hold steady.';
  } catch (e) { stopScan(); st.textContent = 'Could not open the camera: ' + (e.message || e.name) + '. Allow camera permission, or use “Scan from photo”.'; }
}
function stopScan() {
  clearInterval(timer); timer = null;
  stream?.getTracks().forEach(t => t.stop()); stream = null;
  try { zx?.reset(); } catch { } zx = null;
  $('#scanbox').hidden = true; $('#scan-start').hidden = false; $('#scan-stop').hidden = true;
}
function onCode(code) { stopScan(); navigator.vibrate?.(60); lookupBarcode(code); }
async function scanPhoto(file) {
  const st = $('#scan-status'); st.textContent = 'Reading photo…';
  try {
    let code = null;
    if ('BarcodeDetector' in window) { const r = await new BarcodeDetector({ formats: FORMATS }).detect(await createImageBitmap(file)); code = r[0]?.rawValue; }
    else { await loadZX(); const url = URL.createObjectURL(file); try { code = (await new ZXing.BrowserMultiFormatReader().decodeFromImageUrl(url)).getText(); } finally { URL.revokeObjectURL(url); } }
    code ? lookupBarcode(code) : st.textContent = 'No barcode found. Try a sharper, closer photo.';
  } catch { st.textContent = 'No barcode found. Try a sharper, closer photo.'; }
}

// ---------- identify food from a photo (on-device CLIP model, no server, no fees) ----------
let clf = null;
async function getClassifier(onProgress) {
  if (clf) return clf;
  const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2');
  clf = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32', { progress_callback: onProgress });
  return clf;
}
async function identifyPhoto(file) {
  const st = $('#id-status'), box = $('#id-results'), url = URL.createObjectURL(file);
  box.innerHTML = '';
  st.textContent = 'Loading the food-recognition model… (first time only, ~90 MB, then cached on this device)';
  try {
    const c = await getClassifier(p => { if (p.status === 'progress' && p.file?.endsWith('.onnx')) st.textContent = `Downloading model… ${Math.round(p.progress || 0)}%`; });
    st.textContent = 'Analysing photo…';
    const labels = FOODS.map(f => f.label);
    const out = (await c(url, labels, { hypothesis_template: 'a photo of {}, a type of food.' })).slice(0, 5);
    const rows = out.map(o => ({ o, i: labels.indexOf(o.label) })).filter(x => x.i >= 0);
    st.textContent = rows[0]?.o.score < .3 ? 'Not very confident. Pick the closest match, or use Search / Manual.' : 'Best matches. Tap Add, then adjust the grams (the serving is only a typical guess).';
    box.insertAdjacentHTML('beforeend', '<div class="list">' + rows.map(({ o, i }) => `<div class="item"><div class="n"><b>${esc(FOODS[i].name)}</b><span>${Math.round(o.score * 100)}% match · ${r0(FOODS[i].per100.kcal * FOODS[i].serving / 100)} kcal per ${FOODS[i].serving} g</span></div><button class="btn sm primary" data-idpick="${i}">Add</button></div>`).join('') + '</div>');
  } catch (e) { st.textContent = 'Could not run the recognition model (needs internet the first time, and a modern browser). Try barcode, Search or Enter manually.'; }
  finally { setTimeout(() => URL.revokeObjectURL(url), 60000); }
}

// ---------- history ----------
function renderHistory() {
  const ds = Object.keys(db.days).filter(d => { const x = db.days[d]; return x.foods.length || x.steps || x.workouts.length; }).sort().reverse();
  $('#view-history').innerHTML = ptabs('history') + (ds.length ? ds.map(d => {
    const x = db.days[d], t = totals(d), e = expenditure(d), bal = t.kcal - e.total;
    const label = new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    return `<details class="card hday"><summary><b>${label}</b><span class="${x.foods.length ? (bal <= 0 ? 'good' : 'warn') : 'muted'}">${x.foods.length ? `${r0(t.kcal)} eaten · ${bal <= 0 ? '−' : '+'}${r0(Math.abs(bal))}` : 'no food logged'}</span></summary>
      <p class="muted small">Burned ${r0(e.total)} kcal · ${r0(x.steps)} steps · P ${r0(t.protein)} C ${r0(t.carbs)} F ${r0(t.fat)} g${db.weights[d] ? ` · ${db.weights[d]} kg` : ''}</p>
      <div class="list">${x.foods.map(f => `<div class="item"><div class="n"><b>${esc(f.name)}</b><span>${f.meal}${f.grams ? ' · ' + r0(f.grams) + ' g' : ''} · P ${r0(f.protein)} C ${r0(f.carbs)} F ${r0(f.fat)}</span></div><div class="k">${r0(f.kcal)}</div></div>`).join('')}
      ${x.workouts.map(w => `<div class="item"><div class="n"><b>${esc(w.type)}</b><span>${w.cat === 'gym' ? 'Gym' : 'Extra'} · ${w.min} min</span></div><div class="k">${r0(w.kcal)}</div></div>`).join('')}</div>
      <div class="row"><button class="btn sm" data-open-day="${d}">Open / edit this day</button></div></details>`;
  }).join('') : `<div class="card"><div class="empty">${ico('history')}<p>Your logged days will appear here.<br>Nothing is deleted unless you remove it.</p></div></div>`);
}

// ---------- events ----------
document.addEventListener('click', e => {
  const t = e.target.closest('button,a'); if (!t) return;
  if (t.dataset.day) { cur = t.dataset.day; render(); }
  if (t.dataset.addmeal) { addMeal = t.dataset.addmeal; }
  if (t.dataset.meal) { addMeal = t.dataset.meal; renderMealChips(); }
  if (t.dataset.addsteps) { const d = day(); d.steps = num(d.steps) + +t.dataset.addsteps; save(); render(); toast(`+${r0(+t.dataset.addsteps)} steps`); }
  if (t.dataset.min) { $('#workout-form').min.value = t.dataset.min; updateWorkoutPreview(); }
  if (t.dataset.cat) { const f = $('#workout-form'); f.cat.value = t.dataset.cat; $$('[data-cat]', f).forEach(b => { const on = b === t; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); }); }
  if (t.dataset.sex) { $('#welcome-form').dataset.sex = t.dataset.sex; $$('[data-sex]').forEach(b => { const on = b === t; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); }); }
  if (t.dataset.grams) { $('#picker-grams').value = t.dataset.grams; updatePicker(); }
  if (t.dataset.delFood) {
    const d = day(), i = d.foods.findIndex(f => f.id === t.dataset.delFood), gone = d.foods[i], dayKey = cur;
    if (gone) { d.foods.splice(i, 1); save(); render(); toast(`Removed ${gone.name}`, () => { day(dayKey).foods.splice(Math.min(i, day(dayKey).foods.length), 0, gone); save(); render(); }); }
  }
  if (t.dataset.delW) {
    const d = day(), i = d.workouts.findIndex(w => w.id === t.dataset.delW), gone = d.workouts[i], dayKey = cur;
    if (gone) { d.workouts.splice(i, 1); save(); render(); toast('Workout removed', () => { day(dayKey).workouts.splice(Math.min(i, day(dayKey).workouts.length), 0, gone); save(); render(); }); }
  }
  if (t.dataset.openDay) { cur = t.dataset.openDay; location.hash = '#today'; if (view === 'today') render(); }
  if (t.dataset.idpick !== undefined) openPicker(FOODS[+t.dataset.idpick]);
  if (t.dataset.pick !== undefined) openPicker($('#search-results')._items[+t.dataset.pick]);
  if (t.dataset.re !== undefined) { const r = db.recent[+t.dataset.re]; if (r) addFood({ ...r, meal: addMeal }); }
  if (t.dataset.tab) showTab(t.dataset.tab);
});
function showTab(name) {
  $$('#view-add .tab').forEach(x => x.hidden = x.id !== 'tab-' + name);
  if (name !== 'barcode') stopScan();
  if (name === 'home') { const q = $('#search-input').value.trim(); q ? searchFoods(q) : showRecent(); }
  if (name === 'manual') $('#manual-form').meal.value = addMeal;
}
function renderMealChips() {
  $('#meal-chips').innerHTML = MEALS.map(m => `<button data-meal="${m}" role="radio" aria-checked="${m === addMeal}" class="${m === addMeal ? 'on' : ''}">${ico(MEAL_ICON[m])}${m}</button>`).join('');
  const mf = $('#manual-form'); if (mf) mf.meal.value = addMeal;
}
function renderAdd() {
  const t = totals(), b = budget(), pct = b.kcal > 0 ? Math.min(100, t.kcal / b.kcal * 100) : 0;
  $('#add-summary').innerHTML = `<div><b>${cur === todayISO() ? 'Today' : new Date(cur + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}: ${r0(t.kcal)} / ${r0(b.kcal)} kcal</b><div class="t"><i style="width:${pct}%"></i></div></div><a class="btn sm" href="#today">${ico('check')}Done</a>`;
  renderMealChips();
}
$('#scan-start').onclick = startScan; $('#scan-stop').onclick = stopScan;
$('#id-photo').onchange = e => { if (e.target.files[0]) identifyPhoto(e.target.files[0]); e.target.value = ''; };
try { navigator.storage?.persist?.(); } catch { } // ask the browser not to evict saved history
$('#scan-photo').onchange = e => { if (e.target.files[0]) scanPhoto(e.target.files[0]); e.target.value = ''; };
$('#barcode-form').onsubmit = e => { e.preventDefault(); lookupBarcode($('#barcode-input').value); };
$('#search-form').onsubmit = e => { e.preventDefault(); searchFoods($('#search-input').value.trim()); };
let searchT; // live results while typing
$('#search-input').addEventListener('input', () => { clearTimeout(searchT); const q = $('#search-input').value.trim(); searchT = setTimeout(() => searchFoods(q), q.length > 1 ? 350 : 0); });
$('#picker-grams').oninput = updatePicker;
$('#picker-cancel').onclick = () => $('#picker').close();
$('#picker-form').onsubmit = () => {
  const g = num($('#picker-grams').value); if (!(g > 0) || !pending) return;
  const s = scaled(pending, g);
  addFood({ name: pending.name, meal: $('#picker-meal').value, grams: g, ...Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Math.round(v * 10) / 10])) });
};
$('#manual-form').onsubmit = e => {
  e.preventDefault(); const f = e.target, v = k => Math.max(0, num(f[k].value));
  const en = { name: f.name.value.trim().slice(0, 80), meal: f.meal.value, protein: v('protein'), carbs: v('carbs'), fat: v('fat'), fiber: v('fiber'), sugar: v('sugar'), satfat: v('satfat'), sodium: v('sodium') };
  en.kcal = f.kcal.value === '' ? Math.round(en.protein * 4 + en.carbs * 4 + en.fat * 9) : v('kcal');
  if (!en.name) return;
  addFood(en); f.reset(); f.meal.innerHTML = mealOptions(addMeal);
};
$('#steps-form').onsubmit = e => { e.preventDefault(); day().steps = Math.max(0, Math.round(num($('#steps-input').value))); save(); render(); toast('Steps saved'); };
$('#w-type').innerHTML = WORKOUTS.map(w => `<option>${w[0]}</option>`).join('');
$('#workout-form').addEventListener('input', updateWorkoutPreview);
$('#workout-form').onsubmit = e => {
  e.preventDefault(); const f = e.target, i = $('#w-type').selectedIndex, min = Math.round(num(f.min.value));
  if (min < 1) return;
  const kcal = f.kcal.value !== '' ? Math.max(0, num(f.kcal.value)) : Math.round(workoutKcal(WORKOUTS[i][1], min));
  day().workouts.push({ id: uid(), cat: f.cat.value, type: WORKOUTS[i][0], min, kcal, note: f.note.value.trim() });
  save(); f.kcal.value = ''; f.note.value = ''; render(); toast('Workout added');
};
$('#weight-form').onsubmit = e => {
  e.preventDefault(); const w = num($('#weight-input').value); if (w < 20 || w > 400) return;
  db.weights[cur] = Math.round(w * 10) / 10; save(); render(); toast('Weight saved');
};
$('#settings-form').onsubmit = e => {
  e.preventDefault(); const g = id => $('#' + id).value, s = S(), oldGoal = s.goalWeight + '|' + s.goalDate;
  Object.assign(s, { sex: g('s-sex'), age: num(g('s-age')), heightCm: num(g('s-height')), weightKg: num(g('s-weight')), bodyFat: g('s-bf'), waist: g('s-waist'),
    neck: g('s-neck'), hip: g('s-hip'), goalWeight: g('s-goal'), goalDate: g('s-goaldate'), baseline: num(g('s-base')), stepLenCm: g('s-steplen'),
    proteinPerKg: num(g('s-ppk')) || 1.8, fatPct: num(g('s-fatpct')) || 28 });
  if (s.weightKg >= 20) db.weights[todayISO()] = s.weightKg;
  if (!num(s.startWeight) || oldGoal !== s.goalWeight + '|' + s.goalDate) s.startWeight = curWeight();
  save(); render(); toast('Settings saved');
};
$('#export-btn').onclick = () => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' }));
  a.download = `bm-calory-tracker-${todayISO()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$('#import-file').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    if (!j || typeof j.days !== 'object' || typeof j.settings !== 'object') throw 0;
    if (!confirm('Replace all current data with this backup?')) return;
    const d = DEFAULTS(); db = { ...d, ...j, settings: { ...d.settings, ...j.settings } }; save(); fillSettings(); render(); toast('Backup imported');
  } catch { toast('That file is not a valid backup.'); }
};
$('#reset-btn').onclick = async () => {
  if (!confirm(user ? 'Erase ALL data on this device AND your cloud copy? This cannot be undone.' : 'Erase ALL data on this device? This cannot be undone.')) return;
  if (user) { try { await api('DELETE', '/api/data'); } catch { toast('Could not reach the server; cloud copy not erased.'); return; } }
  db = DEFAULTS(); save(false); fillSettings(); render(); toast('All data erased');
};
// ---------- account (Google sign-in) + cloud sync ----------
let user = null, pushT = null;
async function api(method, path, body) {
  const r = await fetch(path, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined });
  if (!r.ok) throw Object.assign(new Error('api ' + r.status), { status: r.status });
  return r.json();
}
function schedulePush() { clearTimeout(pushT); pushT = setTimeout(pushNow, 1500); }
async function pushNow() {
  if (!user) return;
  try { await api('PUT', '/api/data', JSON.stringify(db)); setSync('Synced'); }
  catch (e) { if (e.status === 401) { user = null; renderAccount(); toast('Session expired. Sign in again.'); } else setSync('Offline: will retry on next change'); }
}
let syncMsg = '';
function setSync(m) { syncMsg = m; const el = $('#sync-msg'); if (el) el.textContent = m; }
const hasLocalData = () => Object.values(db.days).some(d => d.foods.length || d.steps || d.workouts.length) || Object.keys(db.weights).length > 0;
async function pull() {
  try {
    const { db: remote } = await api('GET', '/api/data');
    if (!remote) { await pushNow(); return; }
    const d = DEFAULTS(), remoteNewer = (remote.updated || 0) > (db.updated || 0);
    if (remoteNewer && hasLocalData() && !confirm('Cloud data found for this account. OK = use the cloud data, Cancel = keep this device\'s data and overwrite the cloud copy.')) { await pushNow(); return; }
    if (remoteNewer) { db = { ...d, ...remote, settings: { ...d.settings, ...(remote.settings || {}) } }; save(false); fillSettings(); render(); setSync('Synced from cloud'); }
    else await pushNow();
  } catch { setSync('Could not sync'); }
}
function loadGIS() {
  return window.google?.accounts?.id ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
}
async function onGoogleCredential(resp) {
  try { const r = await api('POST', '/api/auth/google', { credential: resp.credential }); user = r.user; renderAccount(); toast('Signed in'); await pull(); }
  catch { toast('Sign-in failed. Please try again.'); }
}
async function renderAccount() {
  const box = $('#account-body'), chip = $('#acct-t');
  if (user) {
    chip.textContent = (user.name || user.email || 'Account').split(' ')[0];
    box.innerHTML = `<div class="row">${user.picture ? `<img class="avatar" src="${esc(user.picture)}" alt="" referrerpolicy="no-referrer">` : ''}<div><b>${esc(user.name)}</b><br><span class="muted small">${esc(user.email)}</span></div></div>
      <p class="muted small" id="sync-msg">${esc(syncMsg)}</p>
      <div class="row"><button class="btn" id="sync-now">Sync now</button><button class="btn" id="logout-btn">Sign out</button></div>`;
    $('#sync-now').onclick = () => pushNow().then(() => toast('Synced'));
    $('#logout-btn').onclick = async () => { try { await api('POST', '/api/auth/logout', {}); } catch { } user = null; syncMsg = ''; window.google?.accounts?.id?.disableAutoSelect(); renderAccount(); toast('Signed out'); };
    return;
  }
  chip.textContent = 'Sign in';
  box.innerHTML = '<p class="muted small">Sign in with Google to keep your data safe and synced across your laptop and phone. It is optional, and the app works without it.</p><div id="g-btn"></div><p class="muted small" id="g-msg"></p>';
  if (location.protocol === 'file:') { $('#g-msg').textContent = 'Sign-in works on the deployed site (or a local server).'; return; }
  try {
    const cfg = await (await fetch('/api/config')).json();
    if (!cfg.clientId || cfg.clientId.startsWith('PASTE')) { $('#g-msg').textContent = 'Google sign-in is not configured yet (see README).'; return; }
    await loadGIS();
    google.accounts.id.initialize({ client_id: cfg.clientId, callback: onGoogleCredential, auto_select: false });
    google.accounts.id.renderButton($('#g-btn'), { theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill' });
  } catch { $('#g-msg').textContent = 'Sign-in is unavailable offline.'; }
}
async function initAuth() {
  try { user = (await api('GET', '/api/me')).user; } catch { user = null; }
  renderAccount(); if (user) pull();
}
// ---------- theme (auto / light / dark) ----------
function applyTheme(t) {
  const dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  $('#theme-ico').setAttribute('href', dark ? '#i-sun' : '#i-moon');
  $('#theme-btn').setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  $('meta[name=theme-color]').content = dark ? '#0e1813' : '#14382b';
}
function savedTheme() { try { return localStorage.getItem('bmct.theme') || ''; } catch { return ''; } }
$('#theme-btn').onclick = () => {
  const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches), next = dark ? 'light' : 'dark';
  try { localStorage.setItem('bmct.theme', next); } catch { }
  applyTheme(next);
};
applyTheme(savedTheme());

// ---------- first-run welcome ----------
function maybeWelcome() {
  if (db.onboarded) return;
  if (hasLocalData()) { db.onboarded = true; save(false); return; }
  $('#welcome-form').dataset.sex = 'male'; $('#welcome').showModal();
}
function finishWelcome(skip) {
  db.onboarded = true;
  if (!skip) {
    const f = $('#welcome-form'), s = S();
    Object.assign(s, { sex: f.dataset.sex || 'male', age: num(f.age.value) || 30, heightCm: num(f.height.value) || 175, weightKg: num(f.weight.value) || 75,
      goalWeight: f.goal.value, goalDate: f.goaldate.value, baseline: num(f.level.value) || 1.2 });
    db.weights[todayISO()] = s.weightKg; s.startWeight = s.weightKg;
  }
  save(); fillSettings(); $('#welcome').close(); render();
  toast(skip ? 'You can set up your profile any time in Profile.' : 'All set. Tap the orange + to log your first meal.');
}
$('#welcome-form').onsubmit = e => { e.preventDefault(); finishWelcome(false); };
$('#welcome-skip').onclick = () => finishWelcome(true);
$('#welcome').addEventListener('cancel', e => { e.preventDefault(); finishWelcome(true); });

window.addEventListener('hashchange', () => go(location.hash.slice(1)));
$('#manual-form').meal.innerHTML = mealOptions(addMeal);
fillSettings(); go(location.hash.slice(1) || 'today'); initAuth(); maybeWelcome();

if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { });

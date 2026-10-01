'use strict';
// Older Safari lacks OffscreenCanvas, which the image model needs. A plain <canvas> is a close enough stand-in.
if (typeof OffscreenCanvas === 'undefined') {
  window.OffscreenCanvas = class { constructor(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.convertToBlob = o => new Promise(r => c.toBlob(r, o?.type, o?.quality)); return c; } };
}
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
  'Buffalo curd': 'meekiri curd mee kiri yogurt kotmale', 'Coconut milk': 'pol kiri kiri', 'King coconut water (thambili)': 'thambili king coconut', 'Milk tea with sugar': 'plain tea kiri thé tea',
  'Kola kanda (herbal porridge)': 'kola kenda kanda porridge', 'Roti / chapati': 'roti chapati godamba roti', 'Coconut, fresh': 'pol coconut', 'Pittu': 'puttu', 'Wattalapam': 'watalappan watalappam pudding',
  'Tomato sauce (ketchup)': 'kist md sauce ketchup tomato sos edinborough', 'Mixed fruit jam': 'kist md jam mixed fruit pineapple strawberry marmalade', 'Milk powder, full cream': 'anchor lakspray nespray ridgways kotmale dano powder milk',
  'Condensed milk, sweetened': 'milkmaid condensed', 'Milk, whole': 'kotmale highland anchor fresh milk full cream pasteurised uht', 'Samaposha (cereal blend)': 'samaposha samposha sampoosha lanka cic cereal corn soya',
  'Apple juice (Kist)': 'kist juice nectar' };
// household units per food: [singular, plural, grams]. Typical sizes, so adjust if yours differ.
const UNITS = {
  'Egg, whole boiled': [['egg', 'eggs', 50]], 'Egg, fried': [['egg', 'eggs', 46]], 'Egg, scrambled': [['egg', 'eggs', 61]], 'Egg, omelette': [['omelette', 'omelettes', 100]], 'Egg white, boiled': [['egg white', 'egg whites', 33]],
  'Chicken breast, cooked': [['piece', 'pieces', 120]], 'Salmon, cooked': [['fillet', 'fillets', 120]], 'Tuna, canned in water': [['can', 'cans', 112]],
  'Rice, white cooked': [['cup', 'cups', 160], ['plate', 'plates', 250]], 'Rice, brown cooked': [['cup', 'cups', 160], ['plate', 'plates', 250]], 'Red rice (kekulu), cooked': [['cup', 'cups', 160], ['plate', 'plates', 250]],
  'Oats, dry': [['cup', 'cups', 80], ['tablespoon', 'tablespoons', 7]], 'Bread, white': [['slice', 'slices', 30]], 'Bread, wholewheat': [['slice', 'slices', 35]], 'Roti / chapati': [['roti', 'rotis', 45]], 'Pol roti': [['roti', 'rotis', 60]],
  'Pasta, cooked': [['cup', 'cups', 140]], 'Noodles, cooked': [['cup', 'cups', 160]], 'Fried rice': [['plate', 'plates', 250]],
  'Potato, boiled': [['potato', 'potatoes', 150]], 'Sweet potato, baked': [['potato', 'potatoes', 130]],
  'Banana': [['banana', 'bananas', 118]], 'Apple': [['apple', 'apples', 180]], 'Orange': [['orange', 'oranges', 130]], 'Mango': [['mango', 'mangoes', 200], ['cup sliced', 'cups sliced', 165]],
  'Grapes': [['cup', 'cups', 150]], 'Watermelon': [['slice', 'slices', 280]], 'Strawberries': [['cup', 'cups', 150]], 'Pineapple': [['slice', 'slices', 84]], 'Papaya': [['cup', 'cups', 140]], 'Avocado': [['half', 'halves', 100]],
  'Milk, whole': [['cup', 'cups', 240]], 'Milk, skim': [['cup', 'cups', 240]], 'Greek yogurt, plain 0%': [['cup', 'cups', 245]], 'Buffalo curd': [['cup', 'cups', 200]],
  'Cheddar cheese': [['slice', 'slices', 28]], 'Butter': [['teaspoon', 'teaspoons', 5], ['tablespoon', 'tablespoons', 14]], 'Olive oil': [['teaspoon', 'teaspoons', 5], ['tablespoon', 'tablespoons', 14]], 'Peanut butter': [['tablespoon', 'tablespoons', 16]],
  'Almonds': [['handful', 'handfuls', 28]], 'Honey': [['teaspoon', 'teaspoons', 7], ['tablespoon', 'tablespoons', 21]], 'Sugar': [['teaspoon', 'teaspoons', 4], ['tablespoon', 'tablespoons', 12.5]], 'Cola': [['can', 'cans', 330], ['glass', 'glasses', 250]],
  'Coconut milk': [['cup', 'cups', 240], ['tablespoon', 'tablespoons', 15]], 'Milk tea with sugar': [['cup', 'cups', 200]], 'King coconut water (thambili)': [['king coconut', 'king coconuts', 300]], 'Kola kanda (herbal porridge)': [['bowl', 'bowls', 250]],
  'Lentils, cooked': [['cup', 'cups', 165]], 'Chickpeas, cooked': [['cup', 'cups', 165]], 'Dhal curry': [['serving', 'servings', 150]],
  'Pizza': [['slice', 'slices', 110]], 'Cheeseburger': [['burger', 'burgers', 150]], 'French fries': [['serving', 'servings', 120]], 'Cake': [['slice', 'slices', 80]], 'Cookie': [['cookie', 'cookies', 30]],
  'Ice cream, vanilla': [['scoop', 'scoops', 66]], 'Dark chocolate 70%': [['square', 'squares', 10]], 'Whey protein powder': [['scoop', 'scoops', 30]],
  'Kottu roti, chicken': [['plate', 'plates', 350]], 'Kottu roti, vegetable': [['plate', 'plates', 350]], 'Kottu roti, egg': [['plate', 'plates', 350]],
  'Hopper, plain (appa)': [['hopper', 'hoppers', 60]], 'Hopper, egg': [['egg hopper', 'egg hoppers', 100]], 'String hoppers (idiyappam)': [['string hopper', 'string hoppers', 15]],
  'Pittu': [['roll', 'rolls', 100]], 'Kiribath (milk rice)': [['piece', 'pieces', 60]], 'Rice & curry plate (veg + dhal)': [['plate', 'plates', 400]], 'Lamprais': [['packet', 'packets', 450]],
  'Pol sambol': [['tablespoon', 'tablespoons', 20]], 'Lunu miris': [['tablespoon', 'tablespoons', 20]], 'Seeni sambol': [['tablespoon', 'tablespoons', 20]], 'Mallum (leaves with coconut)': [['serving', 'servings', 60]],
  'Jackfruit curry (polos)': [['serving', 'servings', 100]], 'Potato curry': [['serving', 'servings', 100]], 'Beetroot curry': [['serving', 'servings', 80]], 'Chicken curry (Sri Lankan)': [['piece', 'pieces', 100]],
  'Fish curry (ambul thiyal)': [['piece', 'pieces', 100]], 'Egg curry': [['serving', 'servings', 120]], 'Sambar': [['cup', 'cups', 200]],
  'Dosa (thosai)': [['dosa', 'dosas', 100]], 'Idli': [['idli', 'idlis', 40]], 'Vegetable roll / samosa': [['roll', 'rolls', 70]], 'Fish cutlet': [['cutlet', 'cutlets', 60]], 'Fish roll': [['roll', 'rolls', 80]],
  'Paruppu vadai': [['vadai', 'vadai', 45]], 'Wattalapam': [['serving', 'servings', 100]], 'Kavum (oil cake)': [['kavum', 'kavum', 50]], 'Kokis': [['kokis', 'kokis', 20]], 'Kalu dodol': [['piece', 'pieces', 30]],
  'Tomato sauce (ketchup)': [['tablespoon', 'tablespoons', 17], ['teaspoon', 'teaspoons', 6]], 'Mixed fruit jam': [['tablespoon', 'tablespoons', 20], ['teaspoon', 'teaspoons', 7]],
  'Milk powder, full cream': [['tablespoon', 'tablespoons', 8], ['cup', 'cups', 128]], 'Condensed milk, sweetened': [['tablespoon', 'tablespoons', 20]],
  'Samaposha (cereal blend)': [['tablespoon', 'tablespoons', 8]], 'Chocolate flavoured milk (Kotmale)': [['glass', 'glasses', 250]], 'Flairs flavoured milk (Kotmale)': [['glass', 'glasses', 250]],
  'Vanilla flavoured milk (Kotmale)': [['glass', 'glasses', 250]], 'Iced coffee (Kotmale)': [['glass', 'glasses', 250]], 'Apple juice (Kist)': [['glass', 'glasses', 250]]
};
// household measures offered for EVERY food (grams per measure depends on how dense the food is)
const UNI = {
  fat: [['tablespoon', 'tablespoons', 14], ['teaspoon', 'teaspoons', 4.7], ['cup', 'cups', 218]],
  thick: [['tablespoon', 'tablespoons', 18], ['teaspoon', 'teaspoons', 6], ['cup', 'cups', 250]],
  dry: [['tablespoon', 'tablespoons', 8], ['teaspoon', 'teaspoons', 3], ['cup', 'cups', 120]],
  liquid: [['tablespoon', 'tablespoons', 15], ['teaspoon', 'teaspoons', 5], ['cup', 'cups', 240]]
};
function universalUnits(item) {
  const n = item.name.toLowerCase();
  const k = /\b(oil|ghee|butter|margarine|lard)\b/.test(n) ? 'fat'
    : /(jam|marmalade|spread|honey|syrup|jelly|sauce|ketchup|paste|chutney|sambol|mayonnaise|curd|yogh?urt|cream|dhal|curry|pickle)/.test(n) ? 'thick'
    : /(powder|flour|oats|sugar|salt|cereal|samaposha|cocoa|milo|horlicks|biscuit|cracker|rice|noodle|pasta|nuts?)/.test(n) ? 'dry' : 'liquid';
  return UNI[k].map(([l, p, g]) => ({ l, p, g, approx: true }));
}
const perLabel = it => { const u = it.units?.[0]; return u ? `${r0(it.per100.kcal * u.g / 100)} kcal per ${u.l}` : `${r0(it.per100.kcal * (it.serving || 100) / 100)} kcal per ${it.serving || 100} g`; };
const itemSub = f => f.qtyLabel ? `${f.qtyLabel} · ${r0(f.grams)} g` : (f.grams ? r0(f.grams) + ' g' : '');
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
  ['Salad, mixed greens', 17, 1.5, 3, .2, 1.8, 1, 28, 0],
  ['Egg, fried', 196, 13.6, .8, 14.8, 0, .4, 207, 4.4], ['Egg, scrambled', 149, 10, 1.6, 11, 0, 1.4, 145, 3.3], ['Egg, omelette', 154, 10.6, .6, 11.7, 0, .6, 155, 3.5], ['Egg white, boiled', 52, 10.9, .7, .2, 0, .7, 166, 0], ['Dhal curry', 105, 6, 14, 3, 4, 1.5, 200, 1.5],
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
  ['Kola kanda (herbal porridge)', 60, 1, 10, 2, 1, 0, 100, 1.5, 'LK'],
  // Supermarket staples: typical values for the category (brands such as Kist, MD, Anchor differ slightly, so check the pack)
  ['Tomato sauce (ketchup)', 101, 1, 27.4, .1, .3, 22.8, 907, 0, 'LK'], ['Mixed fruit jam', 278, .4, 68.9, .1, 1.1, 48.5, 32, 0, 'LK'],
  ['Milk powder, full cream', 496, 26.3, 38.4, 26.7, 0, 38.4, 371, 16.7, 'LK'], ['Condensed milk, sweetened', 321, 7.9, 54.4, 8.7, 0, 54.4, 127, 5.5, 'LK'],
  // Sri Lankan products with values listed in Open Food Facts (community data; fiber, sugar and sodium not listed)
  ['Samaposha (cereal blend)', 396, 18.9, 60.3, 6.7, 0, 0, 0, 0, 'OFF'],
  ['Chocolate flavoured milk (Kotmale)', 87.1, 2.44, 14.12, 2.34, 0, 0, 0, 0, 'OFF'], ['Flairs flavoured milk (Kotmale)', 106, 2.64, 17.1, 2.85, 0, 0, 0, 0, 'OFF'],
  ['Vanilla flavoured milk (Kotmale)', 114.8, 4.04, 13.28, 4.51, 0, 0, 0, 0, 'OFF'], ['Iced coffee (Kotmale)', 51.6, 2.74, 12.5, 2.9, 0, 0, 0, 0, 'OFF'],
  ['Apple juice (Kist)', 46, .1, 11.3, .1, 0, 0, 0, 0, 'OFF'],
  ['Cream cracker biscuit (Maliban Smart)', 444, 10.4, 70.2, 13.5, 0, 0, 0, 0, 'OFF'], ['Cheese bits (Maliban)', 445, 11, 75, 11.2, 0, 0, 0, 0, 'OFF']
].map(f => ({ name: f[0], serving: SERV[f[0]] || 100, label: foodLabel(f[0]), units: (UNITS[f[0]] || []).map(([l, p, g]) => ({ l, p, g })), src: f[9] === 'LK' ? 'Sri Lankan / typical' : f[9] === 'OFF' ? 'Open Food Facts · Sri Lanka' : 'built-in', per100: { kcal: f[1], protein: f[2], carbs: f[3], fat: f[4], fiber: f[5], sugar: f[6], sodium: f[7], satfat: f[8] } }));

// ---------- storage ----------
const KEY = 'bmct.v1';
const DEFAULTS = () => ({
  settings: { sex: 'male', age: 30, heightCm: 175, weightKg: 75, bodyFat: '', waist: '', neck: '', hip: '', goalWeight: '', goalDate: '',
    startWeight: '', baseline: 1.2, proteinPerKg: 1.8, fatPct: 28, stepLenCm: '', waterMl: '', planMode: 'auto', manualDeficit: '', manualTarget: '', calibrate: 'on', maintOverride: '' },
  days: {}, weights: {}, recent: [], custom: [], workout: null, sessions: []
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
function save(push = true, touch = true) {
  if (touch) db.updated = Date.now();
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
// Weight on a given day (latest weigh-in on or before it), so older diary days use the weight you actually had then.
function weightOn(d) {
  const ds = Object.keys(db.weights).sort(); let w = null;
  for (const k of ds) { if (k <= d) w = db.weights[k]; else break; }
  return w ?? (ds.length ? db.weights[ds[0]] : num(S().weightKg));
}
function bmr(w = curWeight()) {
  const s = S();
  if (num(s.bodyFat) > 0) return { v: 370 + 21.6 * w * (1 - num(s.bodyFat) / 100), f: 'Katch-McArdle' };
  return { v: 10 * w + 6.25 * num(s.heightCm) - 5 * num(s.age) + (s.sex === 'male' ? 5 : -161), f: 'Mifflin-St Jeor' };
}
const stepLenM = () => (num(S().stepLenCm) || num(S().heightCm) * (S().sex === 'male' ? .415 : .413)) / 100;
const stepsKcal = (steps, w = curWeight()) => .5 * w * steps * stepLenM() / 1000; // 0.5 kcal/kg/km net walking cost
const workoutKcal = (met, min, w = curWeight()) => (met - 1) * w * min / 60;
// Steps your activity level already assumes (Tudor-Locke & Bassett 2004 step bands), so walking is not counted twice.
const expectedSteps = () => Math.round(3000 + (Math.min(1.5, Math.max(1.2, num(S().baseline) || 1.2)) - 1.2) / .1 * 2667);

function totals(d = cur) {
  const t = Object.fromEntries(NUTR.map(n => [n[0], 0]));
  (db.days[d]?.foods || []).forEach(f => NUTR.forEach(n => t[n[0]] += num(f[n[0]])));
  return t;
}
// Formula estimate for one day: resting burn x daily-life level (or your own figure) + steps above the level's assumption + workouts.
function expRaw(d = cur) {
  const dd = db.days[d] || { steps: 0, workouts: [] }, w = weightOn(d), s = S();
  const base = num(s.maintOverride) > 0 ? num(s.maintOverride) : bmr(w).v * num(s.baseline);
  const st = stepsKcal(Math.max(0, num(dd.steps) - expectedSteps()), w);
  const wk = (dd.workouts || []).reduce((a, x) => a + num(x.kcal), 0);
  return { base, steps: st, workouts: wk, total: base + st + wk };
}
// Personal calibration (energy-balance method): over the last 4 weeks, calories out = average intake - (weight trend x 7,700 kcal/kg).
// The ratio of that measured figure to the formula nudges every estimate toward YOUR metabolism, limited to +/-20% and scaled by how much data there is.
let calCache = null;
function calibration() {
  const s = S(), key = `${db.updated}|${todayISO()}|${s.calibrate}|${s.maintOverride}`;
  if (calCache?.key === key) return calCache.v;
  const v = calibrate(); calCache = { key, v }; return v;
}
function calibrate() {
  const s = S();
  if (num(s.maintOverride) > 0) return { k: 1, status: 'override' };
  if (s.calibrate === 'off') return { k: 1, status: 'off' };
  const today = todayISO(), start = addDays(today, -28), need = { logged: 10, weighIns: 4, span: 10 };
  const pts = Object.keys(db.weights).filter(d => d >= start && d <= today).sort().map(d => ({ d, w: db.weights[d] }));
  const days = Array.from({ length: 28 }, (_, i) => addDays(today, -(i + 1))); // finished days only
  const first = pts[0]?.d, last = pts[pts.length - 1]?.d;
  const span = pts.length > 1 ? (new Date(last) - new Date(first)) / 864e5 : 0;
  const inSpan = first ? days.filter(d => d >= first && d <= last) : [];
  const logged = inSpan.filter(d => totals(d).kcal >= 800);
  const info = { k: 1, status: 'learning', need, weighIns: pts.length, span, logged: days.filter(d => totals(d).kcal >= 800).length };
  if (pts.length < need.weighIns || span < need.span || logged.length < need.logged) return info;
  if (logged.length / inSpan.length < .6) return { ...info, status: 'sparse' };
  const t0 = new Date(first).getTime(), xs = pts.map(p => (new Date(p.d) - t0) / 864e5), ys = pts.map(p => p.w);
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0), slope = sxx ? xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx : 0; // kg/day
  if (Math.abs(slope) * 7 > 1.5) return { ...info, status: 'noisy' };
  const intake = logged.reduce((a, d) => a + totals(d).kcal, 0) / logged.length;
  const observed = intake - slope * KCAL_PER_KG;
  const formula = logged.reduce((a, d) => a + expRaw(d).total, 0) / logged.length;
  const raw = formula > 0 ? observed / formula : 1, clamped = Math.min(1.2, Math.max(.8, raw));
  const conf = Math.min(1, logged.length / 21) * Math.min(1, span / 14);
  return { ...info, status: 'calibrated', k: 1 + conf * (clamped - 1), raw, conf, observed, formula, slope, logged: logged.length };
}
function expenditure(d = cur) {
  const r = expRaw(d), k = calibration().k;
  return { base: r.base * k, steps: r.steps * k, workouts: r.workouts * k, total: r.total * k, k };
}
const calNote = () => {
  const c = calibration();
  if (c.status === 'calibrated') return ` Fine-tuned ${c.k >= 1 ? '+' : '−'}${Math.abs(Math.round((c.k - 1) * 100))}% from your own food and weight logs.`;
  if (c.status === 'learning') return ' Still learning from your logs (see Profile).';
  if (c.status === 'override') return ' Using your own maintenance figure.';
  return '';
};
function maintStatus() {
  const c = calibration();
  if (c.status === 'override') return `Using your own maintenance figure (${r0(num(S().maintOverride))} kcal/day). Fine-tuning is off.`;
  if (c.status === 'off') return 'Fine-tuning is off. Maintenance comes from the formula only, which can be 10–20% off for an individual.';
  if (c.status === 'sparse') return 'You logged food on too few days between your weigh-ins to fine-tune. Log most days (at least 60%) for a better estimate.';
  if (c.status === 'noisy') return 'Your recent weight changes look too large to be reliable (over 1.5 kg/week), so fine-tuning is paused.';
  if (c.status === 'learning') return `<b>Learning your metabolism.</b> Last 4 weeks: ${c.logged} of ${c.need.logged} logged days, ${c.weighIns} of ${c.need.weighIns} weigh-ins, ${Math.floor(c.span)} of ${c.need.span}+ days apart. Log food and weigh yourself regularly and your estimate will adjust to you.`;
  return `<b>Fine-tuned from your logs.</b> Over the last ${c.logged} logged days your measured burn was about ${r0(c.observed)} kcal/day, against ${r0(c.formula)} from the formula. Estimates are adjusted ${c.k >= 1 ? '+' : '−'}${Math.abs(Math.round((c.k - 1) * 100))}% (confidence ${Math.round(c.conf * 100)}%).`;
}
// Goal planner: dynamic energy-balance model (simplified from Hall et al., Lancet 2011).
// Daily calorie burn falls by about ADAPT kcal for every kg of body weight lost (and rises when gaining), so a fixed daily deficit
// slows down over time. Solving dx/dt = (D - a*x)/rho for the kg changed x gives the deficit that lands on the goal date:
//   D = a * delta / (1 - e^(-a*T/rho))     (delta = kg to change, T = days, rho = 7,700 kcal/kg)
const ADAPT = 22;
const intakeFloor = () => S().sex === 'male' ? 1500 : 1200; // common unsupervised minimum (NHLBI 1998)
function plan() {
  const s = S(); if (!num(s.goalWeight) || !s.goalDate) return null;
  const w = curWeight(), goal = num(s.goalWeight), rho = KCAL_PER_KG;
  const days = Math.ceil((new Date(s.goalDate + 'T12:00:00') - new Date(todayISO() + 'T12:00:00')) / 864e5);
  if (days <= 0) return { expired: true };
  const diff = w - goal; // >0 lose, <0 gain
  const needed = diff ? ADAPT * diff / (1 - Math.exp(-ADAPT * days / rho)) : 0;
  const cap = diff >= 0 ? Math.min(1000, .01 * w * rho / 7) : 500; // about 1% of body weight per week when losing; 500 kcal/day surplus when gaining
  const capped = Math.abs(needed) > cap, deficit = capped ? Math.sign(needed) * cap : needed;
  const simple = diff * rho / days; // the plain 7,700 rule, for comparison
  const warns = []; let eta = null;
  if (capped) {
    const x = ADAPT * Math.abs(diff) / cap;
    if (x < 1) eta = new Date(Date.now() - rho / ADAPT * Math.log(1 - x) * 864e5);
    const word = diff > 0 ? 'deficit' : 'surplus', limit = diff > 0 ? ' (about 1% of body weight per week)' : '';
    warns.push(`Reaching ${r1(goal)} kg by then would need a ${r0(Math.abs(needed))} kcal/day ${word}, above the safe limit of ${r0(cap)} kcal/day${limit}. ` + (eta
      ? `The plan uses ${r0(cap)} kcal/day instead, which gets you there around ${eta.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}.`
      : `At that limit your weight would level off before ${r1(goal)} kg, because your body burns less as you lose weight. Choose a closer goal or a later date.`));
  }
  return { days, diff, deficit, needed, simple, capped, cap, eta, perWeek: deficit / rho * 7, warns, goal };
}
function budget() {
  const e = expenditure().total, s = S(), p = plan(), manualT = num(s.manualTarget);
  if (s.planMode === 'target' && manualT > 0) return { kcal: manualT, deficit: e - manualT, e, mode: 'target' };
  if (s.planMode === 'deficit' && s.manualDeficit !== '' && s.manualDeficit != null) { const d = num(s.manualDeficit); return { kcal: Math.max(0, e - d), deficit: d, e, mode: 'deficit' }; }
  if (p && !p.expired) { const kcal = Math.max(e - p.deficit, intakeFloor()); return { kcal, deficit: e - kcal, e, mode: 'auto' }; }
  return { kcal: e, deficit: 0, e, mode: 'maintain' };
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
  try { if (t.showPopover && !t.matches(':popover-open')) t.showPopover(); } catch { }
  t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(hideToast, undo ? 6000 : 2600);
}
function hideToast() { const t = $('#toast'); t.classList.remove('on'); try { if (t.hidePopover && t.matches(':popover-open')) t.hidePopover(); } catch { } }
$('#toast-undo').onclick = () => { const f = undoFn; undoFn = null; hideToast(); f?.(); };
const mealOptions = sel => MEALS.map(m => `<option${m === sel ? ' selected' : ''}>${m}</option>`).join('');
const defaultMeal = () => { const h = new Date().getHours(); return h < 11 ? 'Breakfast' : h < 15 ? 'Lunch' : h < 21 ? 'Dinner' : 'Snack'; };
let addMeal = defaultMeal();
let view = 'today';
function go(v) {
  if (v === 'add') { history.replaceState(null, '', '#' + view); openAdd(); if (!$('.view.on')) go(view); return; }
  if (!$('#view-' + v)) v = 'today';
  view = v;
  $$('.view').forEach(e => e.classList.toggle('on', e.id === 'view-' + v));
  $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.view === v || a.dataset.also === v));
  render(); window.scrollTo(0, 0);
}
function renderDayStrip() {
  const t = todayISO(), dt = new Date(cur + 'T12:00:00');
  const label = cur === t ? 'Today' : cur === addDays(t, -1) ? 'Yesterday' : dt.toLocaleDateString(undefined, { weekday: 'long' });
  $('#datenav').innerHTML = `<button class="icon-btn" data-shift="-1" aria-label="Previous day">${ico('left')}</button><div class="dtitle"><b>${label}</b><span>${dt.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</span></div><button class="icon-btn" data-shift="1" aria-label="Next day" ${cur >= t ? 'disabled' : ''}>${ico('right')}</button>`;
}
function render() {
  $('#datenav').hidden = !['today', 'activity'].includes(view);
  if (!$('#datenav').hidden) renderDayStrip();
  ({ today: renderToday, history: renderHistory, activity: renderActivity, progress: renderProgress, settings: renderSettings, workout: () => window.renderWorkout?.() }[view] || (() => { }))();
}
const wtabs = a => `<nav class="ptabs" aria-label="Workout sections"><a href="#workout" class="${a === 'workout' ? 'on' : ''}">Workout plan</a><a href="#activity" class="${a === 'activity' ? 'on' : ''}">Steps &amp; extras</a></nav>`;
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
const waterGoal = () => num(S().waterMl) || Math.min(4000, Math.max(1500, Math.round(curWeight() * 35 / 100) * 100));
const fmtWater = ml => ml >= 1000 ? `${+(ml / 1000).toFixed(2)} L` : `${r0(ml)} ml`;
function greeting() {
  const hr = new Date().getHours(), hello = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening', nm = (user?.name || '').split(' ')[0];
  return `<div class="greet">${user?.picture ? `<img class="av" src="${esc(user.picture)}" alt="" referrerpolicy="no-referrer">` : ''}<div><span>${hello}</span><b>${nm ? esc(nm) : 'Welcome'}</b></div>${user ? '' : '<a class="syncnudge" href="#settings">Sign in to sync</a>'}</div>`;
}
function planText(b) {
  const word = b.deficit >= 0 ? 'deficit' : 'surplus', d = r0(Math.abs(b.deficit));
  if (b.mode === 'target') return ` Your target is the fixed ${r0(b.kcal)} kcal you set in Profile.`;
  if (b.mode === 'deficit') return ` Your target is calories out minus the ${d} kcal/day ${word} you set in Profile.`;
  if (b.mode === 'auto') return ` Your target is calories out minus a ${d} kcal/day ${word}, worked out from your goal weight and date with a dynamic energy-balance model. You can set your own in Profile.`;
  return ' Set a goal weight and date in Profile to get a target that aims at it.';
}
function renderToday() {
  const t = totals(), e = expenditure(), b = budget(), tg = targets(), bal = t.kcal - e.total;
  const R = 92, C = 2 * Math.PI * R, pct = b.kcal > 0 ? Math.min(1, t.kcal / b.kcal) : 0;
  const left = b.kcal - t.kcal, v = verdictText(t, e, b, bal), foods = day().foods, dd = day();
  const wl = num(dd.water), wg = waterGoal(), glasses = Math.min(16, Math.ceil(wg / 250)), filled = Math.floor(wl / 250);
  const meals = MEALS.map(m => {
    const fs = foods.filter(f => f.meal === m), kc = fs.reduce((a, f) => a + num(f.kcal), 0);
    return `<div class="meal-row"><div class="meal-h"><span class="meal-ico">${ico(MEAL_ICON[m])}</span><b>${m}</b><span class="meal-kc">${fs.length ? r0(kc) + ' kcal' : ''}</span><button class="addmini" data-addmeal="${m}" aria-label="Add food to ${m}">${ico('plus')}</button></div>` +
      fs.map(f => `<div class="item"><div class="n"><b>${esc(f.name)}</b><span>${itemSub(f)}</span></div><div class="k">${r0(f.kcal)}</div><button class="icon-btn sm" data-del-food="${f.id}" aria-label="Delete ${esc(f.name)}">${ico('trash')}</button></div>`).join('') + '</div>';
  }).join('');
  $('#view-today').innerHTML = `
  ${cur === todayISO() ? greeting() : ''}
  <div class="tgrid"><div class="tcol">
  <div class="card hero-card">
    <div class="ring"><svg width="220" height="220" viewBox="0 0 220 220" aria-hidden="true"><circle class="rt" cx="110" cy="110" r="${R}"/><circle class="ra${left < 0 ? ' over' : ''}" cx="110" cy="110" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/></svg>
      <div class="c"><b>${r0(Math.abs(left))}</b><span>${left < 0 ? 'kcal over target' : 'kcal left to eat'}</span></div></div>
    <div class="htiles">
      <div class="ht"><span class="hti">${ico('utensils')}</span><b>${r0(t.kcal)}</b><span>Calories in</span></div>
      <div class="ht"><span class="hti">${ico('flame')}</span><b>${r0(e.total)}</b><span>Calories out</span></div>
      <div class="ht"><span class="hti">${ico('target')}</span><b>${r0(b.kcal)}</b><span>Daily target</span></div>
    </div>
    <details class="hdet"><summary>See the details</summary>
      <div class="breakdown"><span><b>${r0(e.base)}</b>maintenance</span><i>+</i><span><b>${r0(e.steps)}</b>steps</span><i>+</i><span><b>${r0(e.workouts)}</b>workouts</span><i>=</i><span><b>${r0(e.total)}</b>calories out</span></div>
      <div class="verdict ${v.cls}">${ico(v.icon)}<div><b>${v.head}</b><span>${v.sub}</span></div></div>
      <p><b>Maintenance</b> is your resting burn times your activity level (${r1(num(S().baseline))}×, set in Profile). Steps above what your activity level already assumes (about ${r0(expectedSteps())} a day) and workouts are added on top.${calNote()}${planText(b)}</p>
    </details>
  </div>

  <div class="card"><h2>Meals</h2>${meals}</div>
  ${window.workoutTodayCard ? window.workoutTodayCard() : ''}
  </div><div class="tcol">

  <div class="card water"><div class="card-h"><h2>Water</h2><span class="wtotal"><b>${fmtWater(wl)}</b> / ${fmtWater(wg)}</span></div>
    <div class="drops" aria-hidden="true">${Array.from({ length: glasses }, (_, i) => `<span class="drop${i < filled ? ' on' : ''}">${ico('drop')}</span>`).join('')}</div>
    <div class="bar" style="--c:var(--water)"><div class="t"><i style="width:${Math.min(100, wl / wg * 100)}%"></i></div></div>
    <div class="row"><button class="btn primary" data-water="250">${ico('drop')}Glass · 250 ml</button><button class="btn" data-water="500">Bottle · 500 ml</button>${wl ? '<button class="btn quiet sm" data-water="-250" aria-label="Remove 250 ml">Undo</button>' : ''}</div>
  </div>

  <div class="card"><h2>Macros</h2>
    <div class="mbars">${macroBar('Protein', t.protein, tg.protein, 'var(--protein)')}${macroBar('Carbs', t.carbs, tg.carbs, 'var(--carbs)')}${macroBar('Fat', t.fat, tg.fat, 'var(--fat)')}</div>
    <details class="more" style="margin-top:1.2rem"><summary>More nutrients</summary>
      ${bar('Fiber', t.fiber, tg.fiber, 'g', 'var(--accent)')}${bar('Sugar', t.sugar, tg.sugar, 'g', 'var(--warn)', 1)}${bar('Sat. fat', t.satfat, tg.satfat, 'g', 'var(--warn)', 1)}${bar('Sodium', t.sodium, tg.sodium, 'mg', 'var(--warn)', 1)}
    </details>
  </div>
  </div></div>`;
}

function renderActivity() {
  $('#atabs').innerHTML = wtabs('activity');
  const dd = day(), e = expenditure();
  $('#steps-input').value = dd.steps || '';
  $('#steps-note').textContent = dd.steps ? `${r0(dd.steps)} steps ≈ ${r1(dd.steps * stepLenM() / 1000)} km ≈ ${r0(e.steps)} kcal (step length ${r0(stepLenM() * 100)} cm).` : 'Enter the total from your phone or watch.';
  $('#steps-bar').style.width = Math.min(100, num(dd.steps) / STEP_GOAL * 100) + '%';
  $('#steps-goal').textContent = `${r0(num(dd.steps))} / ${r0(STEP_GOAL)}`;
  $('#act-summary').innerHTML = `<p class="lead">${r0(e.total)} kcal burned so far <span class="muted">${r0(e.base)} maintenance + ${r0(e.steps)} steps + ${r0(e.workouts)} workouts</span></p>`;
  $('#workout-list').innerHTML = dd.workouts.length ? dd.workouts.map(w => `<div class="item"><div class="n"><b>${esc(w.type)}</b><span>${w.cat === 'gym' ? 'Gym' : 'Extra'} · ${w.min} min${w.note ? ' · ' + esc(w.note) : ''}</span></div><div class="k">${r0(w.kcal)} kcal</div><button class="icon-btn sm" data-del-w="${w.id}" aria-label="Delete workout">${ico('trash')}</button></div>`).join('') : `<div class="empty">${ico('flame')}<p>No workouts logged.</p></div>`;
  updateWorkoutPreview();
}
function updateWorkoutPreview() {
  const f = $('#workout-form'), met = WORKOUTS[$('#w-type').selectedIndex]?.[1] || 0, min = num(f.min.value);
  $('#w-preview').textContent = f.kcal.value ? `Using your figure: ${r0(num(f.kcal.value))} kcal.` : `Estimate: ${r0(workoutKcal(met, min))} kcal (MET ${met} at ${r1(curWeight())} kg).`;
}

// The day this user started: the earlier of the recorded start and their first logged entry or weigh-in.
function startDate() {
  const keys = [...Object.keys(db.days).filter(d => { const x = db.days[d]; return x.foods.length || x.steps || x.workouts.length || x.water; }), ...Object.keys(db.weights)].sort();
  return [keys[0], db.startedOn].filter(Boolean).sort()[0] || todayISO();
}
// Chart window: the last 14 days, but never before the user's start date.
const chartDays = () => {
  const t = todayISO(), n = Math.max(1, Math.min(14, Math.round((new Date(t) - new Date(startDate())) / 864e5) + 1));
  return Array.from({ length: n }, (_, i) => addDays(t, i - (n - 1)));
};
const chartTitle = () => { const n = chartDays().length; return n < 14 ? `Since you started · ${n} day${n > 1 ? 's' : ''}` : 'Last 14 days'; };
function barsChart() {
  const ds = chartDays();
  const data = ds.map(d => ({ d, i: totals(d).kcal, e: expenditure(d).total, has: !!db.days[d]?.foods.length }));
  const max = Math.max(500, ...data.map(x => Math.max(x.i, x.e))) * 1.1, W = 600, H = 190, bw = W / Math.max(ds.length, 7);
  const y = v => H - 20 - v / max * (H - 30);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Calories in versus calories out, ${chartTitle()}">` +
    [0, .5, 1].map(f => `<line x1="0" x2="${W}" y1="${y(max * f / 1.1)}" y2="${y(max * f / 1.1)}" stroke="var(--line)"/><text x="2" y="${y(max * f / 1.1) - 3}">${r0(max * f / 1.1)}</text>`).join('') +
    data.map((x, k) => `<rect x="${k * bw + 6}" y="${y(x.e)}" width="${bw / 2 - 6}" height="${H - 20 - y(x.e)}" rx="3" fill="var(--line)"/>` +
      (x.has ? `<rect x="${k * bw + bw / 2}" y="${y(x.i)}" width="${bw / 2 - 6}" height="${H - 20 - y(x.i)}" rx="3" fill="${x.i <= x.e ? 'var(--accent)' : 'var(--warn)'}"/>` : '') +
      `<text x="${k * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${x.d.slice(8)}</text>`).join('') + '</svg>' +
    '<div class="legend"><span><i style="background:var(--line)"></i>Calories out</span><span><i style="background:var(--accent)"></i>Calories in (deficit)</span><span><i style="background:var(--warn)"></i>Calories in (surplus)</span></div>';
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
  const p = plan(), w = curWeight(), s = S(), bg = budget();
  let goal = '<p class="muted">Set a goal weight and date in Profile.</p>';
  if (p?.expired) goal = '<p class="warn">Your goal date has passed. Set a new date in Profile.</p>';
  else if (p) {
    const start = num(s.startWeight) || w, tot = start - p.goal;
    const prog = tot ? Math.min(100, Math.max(0, (start - w) / tot * 100)) : 100;
    goal = `<div class="stats"><div class="stat"><b>${r1(w)} → ${r1(p.goal)}</b><span>kg</span></div><div class="stat"><b>${p.days}</b><span>days left</span></div><div class="stat"><b>${r0(Math.abs(bg.deficit))}</b><span>kcal/day ${bg.deficit >= 0 ? 'deficit' : 'surplus'}</span></div></div>
      <div class="bar" style="--c:var(--accent)"><div class="h"><span>Progress</span><span>${r0(prog)}%</span></div><div class="t"><i style="width:${prog}%"></i></div></div>
      <p class="small">Suggested pace: <b>${r1(Math.abs(p.perWeek))} kg/week</b> ${p.perWeek >= 0 ? 'loss' : 'gain'} (${r0(Math.abs(p.deficit))} kcal/day). Your calorie burn falls as you lose weight, so this is a little stricter than the simple 7,700 kcal/kg rule (${r0(Math.abs(p.simple))} kcal/day).</p>${bg.mode === 'target' || bg.mode === 'deficit' ? `<p class="small">You are using your own ${bg.mode === 'target' ? 'calorie target' : 'deficit'} from Profile.</p>` : ''}${p.warns.map(x => `<div class="note">⚠ ${esc(x)}</div>`).join('')}`;
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
  const bf = bodyFat(), bm = bmi();
  $('#progress-body').innerHTML = `<div class="card"><h2>Your body</h2><div class="stats"><div class="stat"><b>${r1(w)}</b><span>kg</span></div><div class="stat"><b>${r1(bm)}</b><span>BMI · ${bmiCat(bm)}</span></div><div class="stat"><b>${r1(bf.v)}%</b><span>body fat</span></div></div><p class="muted small">Body fat: ${bf.src}. Add waist and neck measurements in Profile for a better estimate.</p></div><div class="card"><h2>Goal</h2>${goal}</div><div class="card"><h2>${chartTitle()}</h2>${barsChart()}${trend}</div><div class="card"><h2>Weight</h2>${weightChart()}</div>`;
}

function setPlanUI(mode) {
  mode = ['auto', 'deficit', 'target'].includes(mode) ? mode : 'auto';
  $('#s-planmode').value = mode;
  $$('[data-plan]').forEach(b => { const on = b.dataset.plan === mode; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  $('#plan-deficit').hidden = mode !== 'deficit'; $('#plan-target').hidden = mode !== 'target';
}
function fillSettings() {
  const s = S(), set = (id, v) => $('#' + id).value = v ?? '';
  set('s-sex', s.sex); set('s-age', s.age); set('s-height', s.heightCm); set('s-weight', curWeight()); set('s-bf', s.bodyFat);
  set('s-waist', s.waist); set('s-neck', s.neck); set('s-hip', s.hip); set('s-goal', s.goalWeight); set('s-goaldate', s.goalDate);
  set('s-base', s.baseline); set('s-steplen', s.stepLenCm); set('s-ppk', s.proteinPerKg); set('s-fatpct', s.fatPct); set('s-water', s.waterMl); set('s-deficit', s.manualDeficit); set('s-target', s.manualTarget); setPlanUI(s.planMode); set('s-calib', s.calibrate || 'on'); set('s-maint', s.maintOverride);
}
function renderSettings() {
  const p = plan();
  $('#plan-suggest').innerHTML = p && !p.expired
    ? `<b>Suggested for your goal: ${r0(Math.abs(p.deficit))} kcal/day ${p.deficit >= 0 ? 'deficit' : 'surplus'}</b> (about ${r1(Math.abs(p.perWeek))} kg/week). Your calorie burn falls as you lose weight, so this is a little stricter than the simple 7,700 kcal/kg rule (${r0(Math.abs(p.simple))} kcal/day).${p.capped ? ' Limited to a safe pace.' : ''}`
    : p?.expired ? 'Your goal date has passed. Choose a new date above.' : 'Set a goal weight and date above to get a suggested deficit.';
  $('#maint-status').innerHTML = maintStatus();
  const bf = bodyFat(), b = bmr(), bm = bmi(), mt = expenditure(todayISO()).base;
  $('#derived').innerHTML = [[r1(bm), 'BMI · ' + bmiCat(bm)], [r1(bf.v) + '%', 'Body fat · ' + bf.src], [r0(b.v), 'BMR kcal · ' + b.f], [r0(mt), 'Maintenance · resting + daily life']]
    .map(x => `<div class="stat"><b>${x[0]}</b><span>${x[1]}</span></div>`).join('');
}

// ---------- adding food ----------
function addFood(entry) {
  const f = { id: uid(), ...entry };
  day().foods.push(f);
  db.recent = [{ ...entry }, ...db.recent.filter(r => r.name !== entry.name)].slice(0, 25);
  save(); render(); toast(`Added ${entry.name} (${r0(entry.kcal)} kcal)`);
  if ($('#addsheet').open) { sessionAdded.push(entry); renderAdd(); }
}
let sessionAdded = [];
let pending = null;
let pUnits = [];
const pickerUnit = () => pUnits[+$('#picker-unit').value] || { l: 'g', p: 'g', g: 1 };
const pickerGrams = () => num($('#picker-qty').value) * pickerUnit().g;
function openPicker(item) {
  if (document.body.classList.contains('locked')) return;
  pending = item; const own = item.units || []; pUnits = [...own, ...universalUnits(item).filter(u => !own.some(x => x.l === u.l)), { l: 'g', p: 'g', g: 1 }];
  $('#picker-title').textContent = item.name;
  $('#picker-sub').textContent = `Per 100 g: ${r0(item.per100.kcal)} kcal · P ${r1(item.per100.protein)} · C ${r1(item.per100.carbs)} · F ${r1(item.per100.fat)} g · ${item.src}`;
  $('#picker-unit').innerHTML = pUnits.map((u, i) => `<option value="${i}">${u.l === 'g' ? 'grams (g)' : `${esc(u.l)} · ${u.approx ? '~' : ''}${+u.g.toFixed(1)} g`}</option>`).join('');
  const hasUnit = !!item.units?.length;
  $('#picker-unit').value = hasUnit ? 0 : pUnits.length - 1; $('#picker-qty').value = hasUnit ? 1 : (item.serving || 100);
  $('#picker-meal').innerHTML = mealOptions(addMeal);
  renderQuick(); updatePicker(); $('#picker').showModal();
}
function renderQuick() {
  const u = pickerUnit(), sv = pending.serving || 100;
  $('#picker-quick').innerHTML = u.l === 'g'
    ? [[.5, '½'], [1, '1×'], [1.5, '1½'], [2, '2×']].map(([m, l]) => `<button type="button" class="chipbtn" data-q="${Math.round(sv * m)}">${l} · ${Math.round(sv * m)} g</button>`).join('')
    : [[.5, '½'], [1, '1'], [2, '2'], [3, '3'], [4, '4']].map(([n, l]) => `<button type="button" class="chipbtn" data-q="${n}">${l} ${esc(n === 1 ? u.l : u.p)}</button>`).join('');
}
const scaled = (item, g) => Object.fromEntries(NUTR.map(n => [n[0], (item.per100[n[0]] || 0) * g / 100]));
function updatePicker() {
  const g = pickerGrams(), s = scaled(pending, g);
  $('#picker-eq').textContent = pickerUnit().l === 'g' ? '' : `That is about ${r0(g)} g`;
  $('#picker-preview').innerHTML = `<div class="mp big"><b>${r0(s.kcal)}</b><span>kcal</span></div>` + [['Protein', 'protein'], ['Carbs', 'carbs'], ['Fat', 'fat']].map(([l, k]) => `<div class="mp"><b>${r1(s[k])}</b><span>${l} g</span></div>`).join('');
}
// spelling-tolerant matching: "koththu" = "kottu" = "kothu"
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/(.)\1+/g, '$1').replace(/h/g, '');
function searchLocal(q) {
  // drop a plural "s" first ("eggs" -> "egg"), then normalise spelling
  const w = q.toLowerCase().split(/\s+/).filter(Boolean).map(x => x.length > 3 && x.endsWith('s') ? x.slice(0, -1) : x).map(norm).filter(Boolean);
  return customItems().filter(f => w.every(x => norm(f.name).includes(x))).concat(FOODS.filter(f => { const h = f.hay ||= norm(f.name + ' ' + (ALIAS[f.name] || '')); return w.every(x => h.includes(x)); }));
}
function fromOFF(p) {
  const n = p.nutriments || {};
  if (!p.product_name) return null;
  const brand = (Array.isArray(p.brands) ? p.brands.join(',') : String(p.brands || '')).split(',')[0].trim();
  const name = p.product_name + (brand ? ` (${brand})` : ''), lk = (p.countries_tags || []).includes('en:sri-lanka');
  let kcal = n['energy-kcal_100g'] ?? (n.energy_100g ? n.energy_100g / 4.184 : null);
  if (kcal == null && (n.proteins_100g != null || n.carbohydrates_100g != null || n.fat_100g != null)) kcal = 4 * num(n.proteins_100g) + 4 * num(n.carbohydrates_100g) + 9 * num(n.fat_100g);
  const sq = Math.round(num(p.serving_quantity)), pq = Math.round(num(p.product_quantity)), units = [];
  if (sq > 0) units.push({ l: 'serving', p: 'servings', g: sq });
  if (pq > 0 && pq !== sq) units.push({ l: 'pack', p: 'packs', g: pq });
  if (kcal == null) return { name, src: 'Open Food Facts', lk, nodata: true, units };
  const sod = n.sodium_100g != null ? n.sodium_100g * 1000 : (n.salt_100g != null ? n.salt_100g * 400 : 0);
  return { name, src: lk ? 'Open Food Facts · Sri Lanka' : 'Open Food Facts', lk, serving: sq || 100, units,
    per100: { kcal, protein: n.proteins_100g || 0, carbs: n.carbohydrates_100g || 0, fat: n.fat_100g || 0, fiber: n.fiber_100g || 0, sugar: n.sugars_100g || 0, satfat: n['saturated-fat_100g'] || 0, sodium: sod } };
}
const OFF = 'https://world.openfoodfacts.org';
const OFF_FIELDS = 'product_name,brands,nutriments,serving_quantity,product_quantity,countries_tags';
async function lookupBarcode(code) {
  code = String(code).replace(/\D/g, ''); const st = $('#scan-status');
  if (code.length < 6) { st.textContent = 'That does not look like a barcode.'; return; }
  st.textContent = `Looking up ${code}…`;
  try {
    const r = await fetch(`${OFF}/api/v2/product/${code}.json?fields=${OFF_FIELDS}`);
    const j = await r.json(), item = j.status === 1 ? fromOFF(j.product) : null;
    if (item && !item.nodata) { st.textContent = 'Found.'; openPicker(item); }
    else if (item) { st.textContent = ''; toast('Found the product, but it has no nutrition values. Add them from the pack label once.'); startLabelEntry(item.name); }
    else { st.textContent = ''; toast('Not in the database yet. Add it from the pack label once.'); startLabelEntry(''); }
  } catch { st.textContent = 'Lookup failed. Check your connection, or use Search / Enter manually.'; }
}
// Online search: our own proxy first (fast, no CORS problems once deployed), then Open Food Facts directly.
// A second query limited to Sri Lankan products is merged in, so local brands (Kist, MD, Kotmale...) are not buried.
async function searchOnline(q) {
  const get = async url => { const c = new AbortController(), t = setTimeout(() => c.abort(), 9000); try { const r = await fetch(url, { signal: c.signal }); if (!r.ok) throw 0; return await r.json(); } finally { clearTimeout(t); } };
  const one = async lk => {
    try { return await get(`/api/foods?q=${encodeURIComponent(q)}${lk ? '&lk=1' : ''}`); }
    catch { return await get(`${OFF}/cgi/search.pl?search_terms=${encodeURIComponent(q)}${lk ? '&tagtype_0=countries&tag_contains_0=contains&tag_0=sri-lanka' : ''}&search_simple=1&action=process&json=1&page_size=30&fields=${OFF_FIELDS}`); }
  };
  const [a, b] = await Promise.allSettled([one(false), one(true)]);
  if (a.status === 'rejected' && b.status === 'rejected') throw a.reason;
  const seen = new Set(), items = [];
  for (const j of [b.value, a.value]) for (const p of (j?.products || [])) { const it = fromOFF(p); if (it && !seen.has(it.name.toLowerCase())) { seen.add(it.name.toLowerCase()); items.push(it); } }
  const rank = o => (o.lk ? 0 : 2) + (o.nodata ? 1 : 0); // Sri Lankan with data first, products without nutrition last
  return items.sort((x, y) => rank(x) - rank(y));
}
let searchSeq = 0;
// "My foods": products you saved from a pack label (per 100 g), so they work with units and search forever.
const customItems = () => (db.custom || []).map(c => ({ ...c, src: 'My food', custom: true, units: [{ l: 'serving', p: 'servings', g: c.serving || 100 }] }));
function startLabelEntry(name) {
  if (!$('#addsheet').open) openAdd();
  showTab('manual'); const f = $('#manual-form'); setMmode('per100'); f.name.value = name || ''; (name ? f.kcal : f.name).focus();
}
function setMmode(mode) {
  const f = $('#manual-form'); f.mode.value = mode;
  $$('[data-mmode]').forEach(b => { const on = b.dataset.mmode === mode; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  $('#m-amount').hidden = $('#m-save').hidden = mode !== 'per100';
  $('#m-amount input').required = mode === 'per100';
}
function showRecent() {
  const box = $('#search-results'); ++searchSeq;
  const mine = customItems(); box._items = mine;
  const order = db.recent.map((r, i) => i).sort((x, y) => (db.recent[y].meal === addMeal) - (db.recent[x].meal === addMeal));
  const usual = db.recent.some(r => r.meal === addMeal);
  const myHtml = mine.length ? '<h3>My foods</h3>' + mine.map((it, i) => `<div class="item"><div class="n"><b>${esc(it.name)}</b><span>${r0(it.per100.kcal)} kcal/100 g · saved from label</span></div><button class="btn sm primary" data-pick="${i}">Add</button><button class="icon-btn sm" data-delcustom="${esc(it.id)}" aria-label="Remove ${esc(it.name)} from my foods">${ico('trash')}</button></div>`).join('') : '';
  const recentHtml = db.recent.length
    ? `<h3>${usual ? `Your usual ${addMeal.toLowerCase()} foods` : 'Recent foods'}</h3>` + order.slice(0, 12).map(i => { const r = db.recent[i]; return `<div class="item"><div class="n"><b>${esc(r.name)}</b><span>${r0(r.kcal)} kcal · P ${r0(r.protein)} · C ${r0(r.carbs)} · F ${r0(r.fat)} g</span></div><button class="btn sm primary" data-re="${i}" aria-label="Add ${esc(r.name)} again">Add</button></div>`; }).join('')
    : '';
  box.innerHTML = myHtml + recentHtml || `<div class="empty">${ico('utensils')}<p><b>Search to get started</b><br>Try “kottu”, “rice”, “kist jam” or “banana”. Foods you add are saved here for one-tap logging.</p></div>`;
}
async function searchFoods(q) {
  if (!q) return showRecent();
  const seq = ++searchSeq, box = $('#search-results'), local = searchLocal(q);
  const row = (it, i) => it.nodata
    ? `<div class="item"><div class="n"><b>${esc(it.name)}</b><span>No nutrition values listed yet · ${esc(it.src)}</span></div><button class="btn sm" data-nodata="${i}">Add from label</button></div>`
    : `<div class="item"><div class="n"><b>${esc(it.name)}</b><span>${r0(it.per100.kcal)} kcal/100 g · ${perLabel(it)} · ${esc(it.src)}</span></div><button class="btn sm primary" data-pick="${i}">Add</button></div>`;
  const render = (items, note = '') => {
    box._items = items;
    const add = `<div class="item"><div class="n"><b>Can't find it?</b><span>Save it once from the pack label and it is yours for good.</span></div><button class="btn sm" data-labelnew="${esc(q)}">Add from label</button></div>`;
    box.innerHTML = (items.length ? items.map(row).join('') : `<div class="empty">${ico('search')}<p>No match yet.</p></div>`) + note + add;
  };
  render(local, q.length > 1 ? '<p class="muted small" id="s-load">Searching packaged foods online…</p>' : '');
  if (q.length < 2) return;
  try {
    const online = await searchOnline(q); if (seq !== searchSeq) return;
    const seen = new Set(local.map(f => f.name.toLowerCase()));
    const rest = online.filter(o => !seen.has(o.name.toLowerCase()));
    const withData = rest.filter(o => !o.nodata), noData = rest.filter(o => o.nodata).slice(0, 5);
    render(local.concat(withData, noData), online.length ? '' : '<p class="muted small">No online matches. Try another spelling.</p>');
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
  const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2');
  env.allowLocalModels = false;
  // Use our own same-origin proxy when it exists (works in Safari); otherwise fall back to Hugging Face directly.
  try { const r = await fetch('/api/hf/Xenova/clip-vit-base-patch32/resolve/main/config.json'); if (r.ok) env.remoteHost = location.origin + '/api/hf/'; } catch { }
  // phones (especially iOS Safari) are strict: no worker threads, small quantised model, plain WASM backend
  env.backends.onnx.wasm.numThreads = 1; env.backends.onnx.wasm.proxy = false;
  clf = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32', { device: 'wasm', dtype: 'q8', progress_callback: onProgress });
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
    box.insertAdjacentHTML('beforeend', '<div class="list">' + rows.map(({ o, i }) => `<div class="item"><div class="n"><b>${esc(FOODS[i].name)}</b><span>${Math.round(o.score * 100)}% match · ${perLabel(FOODS[i])}</span></div><button class="btn sm primary" data-idpick="${i}">Add</button></div>`).join('') + '</div>');
  } catch (e) { console.error('photo model failed', e); clf = null; st.textContent = `Could not run the recognition model: ${String(e?.message || e).slice(0, 160)}. Try again on Wi-Fi, or use barcode, Search or Enter manually.`; }
  finally { setTimeout(() => URL.revokeObjectURL(url), 60000); }
}

// ---------- history ----------
function renderHistory() {
  const ds = Object.keys(db.days).filter(d => { const x = db.days[d]; return x.foods.length || x.steps || x.workouts.length || x.water; }).sort().reverse();
  $('#view-history').innerHTML = ptabs('history') + (ds.length ? ds.map(d => {
    const x = db.days[d], t = totals(d), e = expenditure(d), bal = t.kcal - e.total;
    const label = new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    return `<details class="card hday"><summary><b>${label}</b><span class="${x.foods.length ? (bal <= 0 ? 'good' : 'warn') : 'muted'}">${x.foods.length ? `${r0(t.kcal)} eaten · ${bal <= 0 ? '−' : '+'}${r0(Math.abs(bal))}` : 'no food logged'}</span></summary>
      <p class="muted small">Burned ${r0(e.total)} kcal · ${r0(x.steps)} steps${x.water ? ' · ' + fmtWater(x.water) + ' water' : ''} · P ${r0(t.protein)} C ${r0(t.carbs)} F ${r0(t.fat)} g${db.weights[d] ? ` · ${db.weights[d]} kg` : ''}</p>
      <div class="list">${x.foods.map(f => `<div class="item"><div class="n"><b>${esc(f.name)}</b><span>${f.meal}${itemSub(f) ? ' · ' + itemSub(f) : ''} · P ${r0(f.protein)} C ${r0(f.carbs)} F ${r0(f.fat)}</span></div><div class="k">${r0(f.kcal)}</div></div>`).join('')}
      ${x.workouts.map(w => `<div class="item"><div class="n"><b>${esc(w.type)}</b><span>${w.cat === 'gym' ? 'Gym' : 'Extra'} · ${w.min} min</span></div><div class="k">${r0(w.kcal)}</div></div>`).join('')}</div>
      <div class="row"><button class="btn sm" data-open-day="${d}">Open / edit this day</button></div></details>`;
  }).join('') : `<div class="card"><div class="empty">${ico('history')}<p>Your logged days will appear here.<br>Nothing is deleted unless you remove it.</p></div></div>`);
}

// ---------- events ----------
document.addEventListener('click', e => {
  const t = e.target.closest('button,a'); if (!t) return;
  if (t.dataset.shift) { cur = addDays(cur, +t.dataset.shift); if (cur > todayISO()) cur = todayISO(); render(); }
  if (t.dataset.view === 'add' || t.dataset.addmeal) { e.preventDefault(); openAdd(t.dataset.addmeal); return; }
  if (t.id === 'sheet-close' || t.id === 'sheet-done') { $('#addsheet').close(); return; }
  if (t.dataset.water) { const d = day(); d.water = Math.max(0, num(d.water) + +t.dataset.water); save(); render(); toast(+t.dataset.water > 0 ? `+${t.dataset.water} ml water` : 'Removed 250 ml'); }
  if (t.dataset.meal) { addMeal = t.dataset.meal; renderMealChips(); }
  if (t.dataset.addsteps) { const d = day(); d.steps = num(d.steps) + +t.dataset.addsteps; save(); render(); toast(`+${r0(+t.dataset.addsteps)} steps`); }
  if (t.dataset.min) { $('#workout-form').min.value = t.dataset.min; updateWorkoutPreview(); }
  if (t.dataset.cat) { const f = $('#workout-form'); f.cat.value = t.dataset.cat; $$('[data-cat]', f).forEach(b => { const on = b === t; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); }); }
  if (t.dataset.sex) { $('#welcome-form').dataset.sex = t.dataset.sex; $$('[data-sex]').forEach(b => { const on = b === t; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); }); }
  if (t.dataset.q) { $('#picker-qty').value = t.dataset.q; updatePicker(); }
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
  if (t.dataset.mmode) setMmode(t.dataset.mmode);
  if (t.dataset.labelnew !== undefined) startLabelEntry(t.dataset.labelnew);
  if (t.dataset.nodata !== undefined) startLabelEntry($('#search-results')._items[+t.dataset.nodata]?.name || '');
  if (t.dataset.delcustom) { const gone = (db.custom || []).find(c => c.id === t.dataset.delcustom); db.custom = (db.custom || []).filter(c => c.id !== t.dataset.delcustom); save(); showRecent(); if (gone) toast(`Removed ${gone.name}`, () => { db.custom.unshift(gone); save(); showRecent(); }); }
  if (t.dataset.plan) {
    setPlanUI(t.dataset.plan); const p = plan(), b = budget();
    if (t.dataset.plan === 'deficit' && $('#s-deficit').value === '') $('#s-deficit').value = Math.round((p && !p.expired ? p.deficit : 0) / 10) * 10;
    if (t.dataset.plan === 'target' && $('#s-target').value === '') $('#s-target').value = Math.round(b.kcal / 10) * 10;
  }
});
function showTab(name) {
  $$('#addsheet .tab').forEach(x => x.hidden = x.id !== 'tab-' + name);
  if (name !== 'barcode') stopScan();
  if (name === 'home') { const q = $('#search-input').value.trim(); q ? searchFoods(q) : showRecent(); }
  if (name === 'manual') $('#manual-form').meal.value = addMeal;
}
function renderMealChips() {
  $('#meal-chips').innerHTML = MEALS.map(m => `<button data-meal="${m}" role="radio" aria-checked="${m === addMeal}" class="${m === addMeal ? 'on' : ''}">${ico(MEAL_ICON[m])}${m}</button>`).join('');
  const mf = $('#manual-form'); if (mf) mf.meal.value = addMeal;
}
function renderAdd() {
  const t = totals(), b = budget(), pct = b.kcal > 0 ? Math.min(100, t.kcal / b.kcal * 100) : 0, last = sessionAdded[sessionAdded.length - 1];
  const day = cur === todayISO() ? 'Today' : new Date(cur + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  $('#add-summary').innerHTML = `<div class="addinfo">${last ? `<b class="added">${ico('check')} Added ${esc(last.name)}</b><span>${sessionAdded.length} item${sessionAdded.length > 1 ? 's' : ''} this time · ${r0(t.kcal)} / ${r0(b.kcal)} kcal</span>` : `<b>${day}: ${r0(t.kcal)} / ${r0(b.kcal)} kcal</b><span>Tap a food to log it</span>`}<div class="t"><i style="width:${pct}%"></i></div></div><button class="btn sm primary" id="sheet-done">Done</button>`;
  $('#sheet-title').textContent = `Add to ${addMeal}`;
  renderMealChips();
}
function openAdd(meal) {
  if (document.body.classList.contains('locked')) return; // nothing opens behind the sign-in screen
  if (meal) addMeal = meal;
  sessionAdded = []; $('#search-input').value = ''; showTab('home'); renderAdd();
  const d = $('#addsheet'); if (!d.open) d.showModal();
  if (matchMedia('(pointer:fine)').matches) $('#search-input').focus();
}
$('#addsheet').addEventListener('close', () => { stopScan(); showTab('home'); sessionAdded = []; render(); });
$('#scan-start').onclick = startScan; $('#scan-stop').onclick = stopScan;
$('#id-photo').onchange = e => { if (e.target.files[0]) identifyPhoto(e.target.files[0]); e.target.value = ''; };
try { navigator.storage?.persist?.(); } catch { } // ask the browser not to evict saved history
$('#scan-photo').onchange = e => { if (e.target.files[0]) scanPhoto(e.target.files[0]); e.target.value = ''; };
$('#barcode-form').onsubmit = e => { e.preventDefault(); lookupBarcode($('#barcode-input').value); };
$('#search-form').onsubmit = e => { e.preventDefault(); searchFoods($('#search-input').value.trim()); };
let searchT; // live results while typing
$('#search-input').addEventListener('input', () => { clearTimeout(searchT); const q = $('#search-input').value.trim(); searchT = setTimeout(() => searchFoods(q), q.length > 1 ? 350 : 0); });
$('#picker-qty').oninput = updatePicker;
$('#picker-unit').onchange = () => { const g = pickerGrams(); const u = pickerUnit(); $('#picker-qty').value = u.l === 'g' ? Math.round(g) || (pending.serving || 100) : 1; renderQuick(); updatePicker(); };
$('#picker-cancel').onclick = () => $('#picker').close();
$('#picker-form').onsubmit = () => {
  const g = pickerGrams(), u = pickerUnit(), q = num($('#picker-qty').value); if (!(g > 0) || !pending) return;
  const s = scaled(pending, g);
  addFood({ name: pending.name, meal: $('#picker-meal').value, grams: Math.round(g * 10) / 10, ...(u.l !== 'g' ? { qtyLabel: `${+q.toFixed(2)} ${q === 1 ? u.l : u.p}` } : {}), ...Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Math.round(v * 10) / 10])) });
};
$('#manual-form').onsubmit = e => {
  e.preventDefault(); const f = e.target, v = k => Math.max(0, num(f[k].value));
  const en = { name: f.name.value.trim().slice(0, 80), meal: f.meal.value, protein: v('protein'), carbs: v('carbs'), fat: v('fat'), fiber: v('fiber'), sugar: v('sugar'), satfat: v('satfat'), sodium: v('sodium') };
  en.kcal = f.kcal.value === '' ? Math.round(en.protein * 4 + en.carbs * 4 + en.fat * 9) : v('kcal');
  if (!en.name) return;
  if (f.mode.value === 'per100') { // numbers are per 100 g from the pack label: scale to the amount eaten
    const amount = v('amount'); if (!(amount > 0)) { toast('Enter how much you ate.'); return; }
    const per100 = Object.fromEntries(['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'satfat', 'sodium'].map(k => [k, en[k]]));
    if (f.save.checked) { db.custom = [{ id: uid(), name: en.name, per100, serving: amount }, ...(db.custom || []).filter(c => c.name.toLowerCase() !== en.name.toLowerCase())].slice(0, 200); }
    for (const k of Object.keys(per100)) en[k] = Math.round(per100[k] * amount / 100 * 10) / 10;
    en.grams = amount;
  }
  addFood(en); f.reset(); setMmode('portion'); f.meal.innerHTML = mealOptions(addMeal);
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
  if (g('s-planmode') === 'target' && !(num(g('s-target')) >= 800)) { toast('Enter a daily calorie target of at least 800 kcal.'); $('#s-target').focus(); return; }
  if (g('s-planmode') === 'deficit' && g('s-deficit') === '') { toast('Enter your daily deficit in kcal (use a negative number for a surplus).'); $('#s-deficit').focus(); return; }
  Object.assign(s, { sex: g('s-sex'), age: num(g('s-age')), heightCm: num(g('s-height')), weightKg: num(g('s-weight')), bodyFat: g('s-bf'), waist: g('s-waist'),
    neck: g('s-neck'), hip: g('s-hip'), goalWeight: g('s-goal'), goalDate: g('s-goaldate'), baseline: num(g('s-base')), stepLenCm: g('s-steplen'),
    proteinPerKg: num(g('s-ppk')) || 1.8, fatPct: num(g('s-fatpct')) || 28, waterMl: g('s-water'), planMode: g('s-planmode'), manualDeficit: g('s-deficit'), manualTarget: g('s-target'), calibrate: g('s-calib'), maintOverride: g('s-maint') });
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
    const d = DEFAULTS(); db = { ...d, ...j, settings: { ...d.settings, ...j.settings } }; if (user) db.owner = ownerOf(user); else delete db.owner; save(); fillSettings(); render(); toast('Backup imported');
  } catch { toast('That file is not a valid backup.'); }
};
$('#reset-btn').onclick = async () => {
  if (!confirm(user ? 'Erase ALL data on this device AND your cloud copy? This cannot be undone.' : 'Erase ALL data on this device? This cannot be undone.')) return;
  if (user) { try { await api('DELETE', '/api/data'); } catch { toast('Could not reach the server; cloud copy not erased.'); return; } }
  db = DEFAULTS(); if (user) db.owner = ownerOf(user); save(false); fillSettings(); render(); toast('All data erased');
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
  pushT = null;
  if (!user) return true;
  const me = ownerOf(user);
  if (db.owner && db.owner !== me) return false; // never upload another account's copy
  db.owner = me;
  try { await api('PUT', '/api/data', JSON.stringify(db)); setSync('Synced'); return true; }
  catch (e) { if (e.status === 401) { user = null; lockApp('Your session expired. Please sign in again.'); } else setSync('Offline: will retry on next change'); return false; }
}
let syncMsg = '';
function setSync(m) { syncMsg = m; const el = $('#sync-msg'); if (el) el.textContent = m; }
const hasLocalData = () => Object.values(db.days).some(d => d.foods.length || d.steps || d.workouts.length || d.water) || Object.keys(db.weights).length > 0 || (db.sessions || []).length > 0;
// Every local copy is stamped with the account that owns it. Another account's diary is never shown or uploaded.
const ownerOf = u => u?.uid || (u?.email || '').toLowerCase();
function claimDevice() {
  const me = ownerOf(user); if (!me || db.owner === me) return;
  if (db.owner) db = DEFAULTS();                                   // belongs to a different account: discard it
  else if (hasLocalData() && !confirm(`This device has diary entries that are not linked to an account. Add them to ${user.email}? Choose Cancel to discard them.`)) db = DEFAULTS();
  db.owner = me; save(false, false); fillSettings();
}
function adoptRemote(remote) {
  const d = DEFAULTS(); db = { ...d, ...remote, settings: { ...d.settings, ...(remote.settings || {}) }, owner: ownerOf(user) };
  save(false); if (view !== 'settings') fillSettings(); render(); setSync('Synced from cloud');
}
async function pull() {
  try {
    const { db: remote } = await api('GET', '/api/data');
    if (!remote) { await pushNow(); return; }
    if ((remote.updated || 0) > (db.updated || 0)) adoptRemote(remote); else await pushNow();
  } catch { setSync('Could not sync'); }
}
function loadGIS() {
  return window.google?.accounts?.id ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
}
async function onGoogleCredential(resp) {
  try { const r = await api('POST', '/api/auth/google', { credential: resp.credential }); user = r.user; try { localStorage.setItem('bmct.hint', JSON.stringify(user)); } catch { } claimDevice(); renderAccount(); await pull(); afterSignIn(); }
  catch { toast('Sign-in failed. Please try again.'); $('#gate-msg').textContent = 'Sign-in failed. Please try again.'; }
}
// Google Identity Services is set up once and can render its button anywhere (Profile page or the welcome screen).
let gisReady = null;
function setupGoogle() {
  return gisReady ||= (async () => {
    if (location.protocol === 'file:') return false;
    try {
      const cfg = await (await fetch('/api/config')).json();
      if (!cfg.clientId || cfg.clientId.startsWith('PASTE')) return false;
      await loadGIS();
      google.accounts.id.initialize({ client_id: cfg.clientId, callback: onGoogleCredential, auto_select: false });
      return true;
    } catch { return false; }
  })();
}
function setPill() {
  const first = (user?.name || user?.email || 'Account').split(' ')[0];
  $('#acct').innerHTML = user ? `${user.picture ? `<img class="av-sm" src="${esc(user.picture)}" alt="" referrerpolicy="no-referrer">` : ico('user')}<span id="acct-t">${esc(first)}</span>` : `${ico('user')}<span id="acct-t">Sign in</span>`;
}
async function renderAccount() {
  const box = $('#account-body');
  if (user) {
    setPill(); render();
    box.innerHTML = `<div class="row">${user.picture ? `<img class="avatar" src="${esc(user.picture)}" alt="" referrerpolicy="no-referrer">` : ''}<div><b>${esc(user.name)}</b><br><span class="muted small">${esc(user.email)}</span></div></div>
      <p class="muted small" id="sync-msg">${esc(syncMsg || 'Signed in. Changes sync automatically between your devices.')}</p>
      <div class="row"><button class="btn" id="sync-now">Sync now</button><button class="btn" id="logout-btn">Sign out</button></div>`;
    $('#sync-now').onclick = async () => { await autoPull(); await pushNow(); toast('Synced'); };
    $('#logout-btn').onclick = async () => {
      if (!confirm('Sign out? Your diary stays safe in your account and is removed from this device.')) return;
      if (!(await pushNow()) && !confirm('Your latest changes could not be uploaded. Sign out anyway? Unsynced changes on this device will be lost.')) return;
      try { await api('POST', '/api/auth/logout', {}); } catch { }
      user = null; syncMsg = ''; wipeLocal(); window.google?.accounts?.id?.disableAutoSelect(); lockApp();
    };
    return;
  }
  setPill(); render();
  box.innerHTML = '<p class="muted small">Sign in with Google to keep your data safe and synced across your phone and laptop.</p><div id="g-btn" class="gbtn"></div><p class="muted small" id="g-msg"></p>';
  if (await setupGoogle()) google.accounts.id.renderButton($('#g-btn'), { theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill' });
  else $('#g-msg').textContent = location.protocol === 'file:' ? 'Sign-in works on the deployed site.' : 'Sign-in is not available right now (offline, or not set up yet).';
}
function wipeLocal() {
  db = DEFAULTS(); cur = todayISO();
  try { localStorage.removeItem(KEY); localStorage.removeItem('bmct.hint'); } catch { }
  fillSettings(); setPill();
}
async function initAuth() {
  let offline = false;
  try { user = (await api('GET', '/api/me')).user; }
  catch (e) {
    user = null;
    if (e.status === 503) authDown = true;
    else if (!e.status) { try { user = JSON.parse(localStorage.getItem('bmct.hint')); offline = !!user; } catch { } } // no network: stay usable if this device was signed in before
  }
  try { if (user && !offline) localStorage.setItem('bmct.hint', JSON.stringify(user)); else if (!user) localStorage.removeItem('bmct.hint'); } catch { }
  if (user && !offline) claimDevice();
  renderAccount(); if (user && !offline) await pull();
}
// Automatic sync: pick up changes made on another device when you come back to the app (never while your own changes are waiting to upload).
async function autoPull() {
  if (!user || pushT) return;
  try {
    const { db: remote } = await api('GET', '/api/data');
    if (!remote || (remote.updated || 0) <= (db.updated || 0)) return;
    adoptRemote(remote); toast('Updated from your other device');
  } catch (e) { if (e.status === 401) { user = null; lockApp('Your session expired. Please sign in again.'); } }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') autoPull(); });
window.addEventListener('focus', autoPull);
setInterval(() => { if (document.visibilityState === 'visible') autoPull(); }, 60000);

// ---------- theme (auto / light / dark) ----------
function applyTheme(t) {
  const dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  $('#theme-ico').setAttribute('href', dark ? '#i-sun' : '#i-moon');
  $('#theme-btn').setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  $('meta[name=theme-color]').content = dark ? '#0b1220' : '#14307a';
}
function savedTheme() { try { return localStorage.getItem('bmct.theme') || ''; } catch { return ''; } }
$('#theme-btn').onclick = () => {
  const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches), next = dark ? 'light' : 'dark';
  try { localStorage.setItem('bmct.theme', next); } catch { }
  applyTheme(next);
};
applyTheme(savedTheme());

// ---------- first-run profile (shown after signing in, only for a brand-new account) ----------
async function showWelcomeProfile() {
  $('#w-hello').textContent = user ? `Hi ${(user.name || '').split(' ')[0] || 'there'}! ` : '';
  if (!$('#welcome').open) $('#welcome').showModal();
}
function maybeWelcome() {
  if (db.onboarded || document.body.classList.contains('locked')) return;
  if (hasLocalData()) { db.onboarded = true; save(false); return; }
  showWelcomeProfile();
}
// called after a successful Google sign-in and cloud pull
function afterSignIn() {
  unlockApp(); window.ensureWorkoutSeed?.();
  if (hasLocalData() && !db.onboarded) { db.onboarded = true; save(false); }
  render();
  if (db.onboarded) toast(`Welcome back, ${(user?.name || '').split(' ')[0] || 'there'}. Your data is synced.`);
  else showWelcomeProfile();
}
function finishWelcome(skip) {
  db.onboarded = true; db.startedOn ||= todayISO();
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

// ---------- sign-in gate: when signed out, nothing but the login screen is visible ----------
let authDown = false;
function unlockApp() { document.body.classList.remove('locked'); }
function lockApp(msg) {
  document.body.classList.add('locked');
  $$('dialog[open]').forEach(d => d.close()); stopScan(); hideToast();
  renderGate(msg);
}
async function renderGate(msg = '') {
  $('#gate-spin').hidden = false; $('#g-btn-gate').hidden = true; $('#gate-retry').hidden = true; $('#gate-msg').textContent = '';
  const ok = await setupGoogle();
  $('#gate-spin').hidden = true;
  if (ok && !authDown) {
    $('#g-btn-gate').hidden = false; $('#gate-msg').textContent = msg;
    google.accounts.id.renderButton($('#g-btn-gate'), { theme: 'filled_blue', size: 'large', text: 'continue_with', shape: 'pill', width: 280 });
  } else {
    $('#gate-msg').textContent = authDown ? 'Sign-in is not set up on the server yet. Please try again later.' : 'Could not load Google sign-in. Check your connection (or turn off a content blocker for this site) and try again.';
    $('#gate-retry').hidden = false;
  }
}
$('#gate-retry').onclick = () => { gisReady = null; authDown = false; location.reload(); };
async function bootAuth() {
  await initAuth();
  if (user) { unlockApp(); window.ensureWorkoutSeed?.(); render(); maybeWelcome(); } else lockApp();
}

window.addEventListener('hashchange', () => go(location.hash.slice(1)));
$('#manual-form').meal.innerHTML = mealOptions(addMeal);
fillSettings(); go(location.hash.slice(1) || 'today'); bootAuth();

if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { });

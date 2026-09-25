/*
 * Data-model regression tests. Run with `npm test`.
 *
 * No browser needed: the store and the pure helpers are loaded into a vm context
 * with a localStorage mock and a fetch mock that serves the real cocktails.json.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const cocktailsJson = read('cocktails.json');

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures++;
    console.log(`FAIL  ${label}\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`);
  } else {
    console.log(`ok    ${label}`);
  }
}

// --- cocktails.json ---------------------------------------------------------
const seeds = JSON.parse(cocktailsJson);
check('cocktails.json is valid JSON with 20 entries', seeds.length, 20);
check('every seed has name/spiritType/flavorProfile/ingredients',
  seeds.filter(c => !c.spiritType || !c.flavorProfile || !c.name || !Array.isArray(c.ingredients)).map(c => c.name), []);
check('every ingredient is an object with a name',
  seeds.flatMap(c => c.ingredients).filter(i => typeof i.name !== 'string' || !i.name), []);
check('no legacy string ingredients remain', seeds.flatMap(c => c.ingredients).filter(i => typeof i === 'string'), []);
check('amounts are number|null', seeds.flatMap(c => c.ingredients).filter(i => i.amount !== null && typeof i.amount !== 'number'), []);
check('no leading whitespace in names', seeds.filter(c => c.name !== c.name.trim()).map(c => c.name), []);
check("Pimm's Cup garnish is not listed as an ingredient",
  seeds.find(c => c.name === "Pimm's Cup").ingredients.map(i => i.name),
  ["Pimm's No. 1", 'Lemonade', 'Cucumber', 'Mint leaves']);

// --- scripts in a sandbox ---------------------------------------------------
const storage = {};
const sandbox = {
  console, Date, Number, JSON,
  localStorage: {
    getItem: key => (key in storage ? storage[key] : null),
    setItem: (key, value) => { storage[key] = String(value); },
    removeItem: key => { delete storage[key]; },
  },
  fetch: async () => ({ ok: true, status: 200, json: async () => JSON.parse(cocktailsJson) }),
  document: {
    getElementById: id => (id === 'generate-cocktail' ? { addEventListener() {} } : null),
    createElement: () => ({ appendChild() {}, getElementsByTagName: () => [], querySelector: () => null, style: {} }),
    querySelector: () => null,
  },
  FormData: class {},
};
vm.createContext(sandbox);
['tabs.js', 'cocktail-store.js', 'scriptcocktail.js'].forEach(file => vm.runInContext(read(file), sandbox, { filename: file }));

// `const` at the top level of a vm script is lexical, so pull the exports out.
const store = vm.runInContext('cocktailStore', sandbox);
const formatIngredient = vm.runInContext('formatIngredient', sandbox);
const parseIngredients = vm.runInContext('parseIngredients', sandbox);

// --- formatIngredient -------------------------------------------------------
[
  [{ name: 'Gin', amount: 60, unit: 'ml' }, '60 ml Gin'],
  [{ name: 'Orange peel', amount: null, unit: null }, 'Orange peel'],
  [{ name: 'Mint leaves', amount: 8, unit: null }, '8 Mint leaves'],
  [{ name: 'Lime', amount: 4, unit: 'wedges' }, '4 wedges Lime'],
  [{ name: 'Sugar', amount: 2, unit: 'tsp' }, '2 tsp Sugar'],
].forEach(([input, expected]) => check(`formatIngredient ${JSON.stringify(input)}`, formatIngredient(input), expected));

// --- parseIngredients -------------------------------------------------------
const parsed = parseIngredients('60 ml Gin\n15 ml Lemon juice\nLemon peel\n8 Mint leaves\n4 wedges Lime');
check('parseIngredients reads amount, unit and name', parsed[0], { name: 'Gin', amount: 60, unit: 'ml' });
check('parseIngredients keeps multi-word names', parsed[1], { name: 'Lemon juice', amount: 15, unit: 'ml' });
check('parseIngredients handles a line without an amount', parsed[2], { name: 'Lemon peel', amount: null, unit: null });
check('parseIngredients only treats known units as units', parsed[3], { name: 'Mint leaves', amount: 8, unit: null });
check('parseIngredients reads a wedge unit', parsed[4], { name: 'Lime', amount: 4, unit: 'wedges' });
check('parseIngredients drops blank lines', parseIngredients('a\n\n  \nb').length, 2);

// --- store ------------------------------------------------------------------
(async () => {
  await store.load();
  check('store loads all 20 seeds', store.getAll().length, 20);
  check('store reports no load error', store.getError(), null);
  check('seed ids are namespaced', store.getAll()[0].id.startsWith('seed:'), true);
  check('accented names slugify', store.getAll().find(c => c.spiritType === 'Cachaça').id, 'seed:caipirinha');

  check('rejects a cocktail without spiritType',
    store.add({ name: 'Test', flavorProfile: 'Sweet', ingredients: [], instructions: '' }).ok, false);
  check('rejects a cocktail without flavorProfile',
    store.add({ name: 'Test', spiritType: 'Rum', ingredients: [], instructions: '' }).ok, false);
  check('rejects a cocktail without a name',
    store.add({ spiritType: 'Rum', flavorProfile: 'Sweet' }).ok, false);

  const added = store.add({
    name: 'Test Drink', spiritType: 'Rum', flavorProfile: 'Sour',
    ingredients: [{ name: 'Rum', amount: 50, unit: 'ml' }], instructions: 'Shake.',
  });
  check('accepts a complete cocktail', added.ok, true);
  check('total is now 21', store.getAll().length, 21);
  check('a user cocktail is reachable by the filter',
    store.getAll().filter(c => c.spiritType === 'Rum' && c.flavorProfile === 'Sour').map(c => c.name), ['Test Drink']);
  check('the payload is versioned', JSON.parse(storage['cocktail-generator:user-cocktails']).schemaVersion, 1);

  await store.load();
  check('a user cocktail survives a reload', store.getAll().length, 21);

  storage['cocktail-generator:user-cocktails'] = JSON.stringify({ schemaVersion: 0, cocktails: [{ name: 'Old' }] });
  await store.load();
  check('a stale schema is not loaded', store.getAll().length, 20);
  check('a stale schema surfaces an error', /schema v0/.test(store.getError() || ''), true);

  storage['cocktail-generator:user-cocktails'] = JSON.stringify([
    { name: 'Legacy', spiritType: 'Gin', flavorProfile: 'Crisp', ingredients: ['Gin', 'Lemon juice'], instructions: 'Stir.' },
  ]);
  await store.load();
  check('the legacy string format is still readable',
    store.getAll().find(c => c.name === 'Legacy').ingredients,
    [{ name: 'Gin', amount: null, unit: null }, { name: 'Lemon juice', amount: null, unit: null }]);

  console.log(failures === 0 ? '\nAll data-model checks passed.' : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
})();

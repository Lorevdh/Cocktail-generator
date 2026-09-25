/*
 * Checks that index.html and the scripts agree with each other. This is the class
 * of bug the old duplicate id="cocktail-name" was, and the kind that no amount of
 * reading the code reliably catches. Run with `npm test`.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const html = read('index.html');
const script = read('scriptcocktail.js');
const js = ['tabs.js', 'cocktail-store.js', 'scriptcocktail.js'].map(read).join('\n');

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

// --- ids --------------------------------------------------------------------
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
const counts = {};
ids.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
check('no duplicate ids in index.html', Object.entries(counts).filter(([, n]) => n > 1), []);

const lookedUp = [...new Set([...js.matchAll(/getElementById\(['"`]([^'"`$]+)['"`]\)/g)].map(m => m[1]))];
check('every getElementById() target exists in the HTML', lookedUp.filter(id => !ids.includes(id)), []);

// --- tabs pattern -----------------------------------------------------------
const tabs = [...html.matchAll(/role="tab"\s+id="([^"]+)"[^>]*aria-controls="([^"]+)"/g)].map(m => ({ tab: m[1], panel: m[2] }));
const panels = [...html.matchAll(/id="([^"]+)"[^>]*role="tabpanel"/g)].map(m => m[1]);
const roleTabs = tabs.map(t => t.tab);

check('two tabs are declared', tabs.length, 2);
check('every tab controls an existing panel', tabs.filter(t => !panels.includes(t.panel)), []);
check('every panel is labelled by its tab', tabs.filter(t => !html.includes(`aria-labelledby="${t.tab}"`)), []);
check('every panel is focusable for keyboard scrolling',
  tabs.filter(t => !new RegExp(`id="${t.panel}"[^>]*tabindex="0"`).test(html)), []);
check('exactly one tab starts selected', (html.match(/role="tab"[^>]*aria-selected="true"/g) || []).length, 1);
check('unselected tabs are out of the tab order',
  roleTabs.filter(id => id !== 'tab-generate' && !new RegExp(`id="${id}"[^>]*tabindex="-1"`).test(html)), []);
check('the unselected panel starts hidden',
  /id="panel-add"[^>]*role="tabpanel"[^>]*hidden/.test(html), true);
check('the selected panel does not start hidden',
  /id="panel-generate"[^>]*role="tabpanel"[^>]*hidden/.test(html), false);

// --- form fields ------------------------------------------------------------
check('the ingredients field is not type=email', /id="new-ingredients"[^>]*type="email"/.test(html), false);
check('spirit and flavour are required in the form',
  ['new-spirit', 'new-flavour'].filter(id => !new RegExp(`id="${id}"[^>]*required`).test(html)), []);

// --- wiring -----------------------------------------------------------------
check('scripts load in dependency order',
  [...html.matchAll(/<script src="\.\/([^"]+)"><\/script>/g)].map(m => m[1]),
  ['tabs.js', 'cocktail-store.js', 'scriptcocktail.js']);
check('checkbox containers exist', ['spirit-types', 'flavor-profiles'].filter(id => !ids.includes(id)), []);
check('revealCocktail uses the same id prefixes as buildCheckboxes',
  /buildCheckboxes\('spirit-types', 'spirit-type-'/.test(script)
  && /buildCheckboxes\('flavor-profiles', 'flavor-profile-'/.test(script)
  && /`spirit-type-\$\{cocktail\.spiritType\}`/.test(script)
  && /`flavor-profile-\$\{cocktail\.flavorProfile\}`/.test(script), true);

console.log(failures === 0 ? '\nAll structure checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);

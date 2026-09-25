/*
 * Data layer for the Cocktail Generator.
 *
 * Cocktail shape (SCHEMA_VERSION 1):
 * {
 *   id: string,           // stable id; seeds use "seed:<slug>", user cocktails get a generated id
 *   name: string,
 *   spiritType: string,   // REQUIRED, see below
 *   flavorProfile: string,// REQUIRED, see below
 *   ingredients: [{ name: string, amount: number|null, unit: string|null }],
 *   instructions: string,
 *   image: string|null,
 *   origin: 'seed' | 'user'
 * }
 *
 * Why spiritType and flavorProfile are required
 * --------------------------------------------
 * generateCocktail() filters on both fields with &&. A cocktail saved without them
 * makes `selectedSpiritTypes.includes(undefined)` false, so it can never be selected
 * by the generator - it would be stored successfully and then be invisible. add()
 * rejects such cocktails instead of quietly creating one that cannot be reached.
 *
 * `amount` is number|null, where null means "not measured": a garnish, a salt rim, a
 * handful of mint. Deliberately not 0 and not "", so those three never get confused.
 *
 * Persistence
 * -----------
 * The 20 built-in recipes live in cocktails.json and are treated as read-only.
 * User-created cocktails live in localStorage and are merged on top of the seeds.
 * Nothing is ever written back to cocktails.json, so the repository stays the
 * single source of truth for the built-in recipes.
 *
 * The payload in localStorage is wrapped in a schemaVersion so a future change to
 * the cocktail shape can be migrated instead of silently corrupting saved data.
 *
 * Changing the shape
 * ------------------
 * 1. Bump SCHEMA_VERSION below.
 * 2. Add a branch in readUserCocktails() that converts the older version, before the
 *    version check discards it. It currently rejects an unknown version rather than
 *    loading data in a shape it does not recognise.
 * 3. Only then bump the version number in the payload - after migrating, not before.
 *
 * normalizeIngredient() is such a branch: it still reads the original string form
 * "Gin" as { name: "Gin", amount: null, unit: null }.
 *
 * Note that this data lives per browser. Cocktails added by a user are not visible on
 * other devices and do not survive clearing browser data. That is the trade-off for
 * having no backend.
 */

const STORAGE_KEY = 'cocktail-generator:user-cocktails';
const SCHEMA_VERSION = 1;

const cocktailStore = (() => {
  let seeds = [];
  let userCocktails = [];
  let loadError = null;

  function slugify(value) {
    return String(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // strip accents: Cachaça -> cachaca
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  
  function normalizeIngredient(ingredient) {
    if (typeof ingredient === 'string') {
      return { name: ingredient, amount: null, unit: null };
    }
    if (!ingredient || typeof ingredient.name !== 'string') {
      return null;
    }
    const amount = Number.isFinite(ingredient.amount) ? ingredient.amount : null;
    const unit = typeof ingredient.unit === 'string' && ingredient.unit ? ingredient.unit : null;
    return { name: ingredient.name, amount, unit };
  }

  function normalizeCocktail(cocktail) {
    if (!cocktail || typeof cocktail !== 'object') return null;

    const name = typeof cocktail.name === 'string' ? cocktail.name.trim() : '';
    if (!name) return null;

    return {
      name,
      // Both are required: generateCocktail() filters with && on both fields, so a
      // cocktail without them could never be selected by the generator.
      spiritType: typeof cocktail.spiritType === 'string' ? cocktail.spiritType : '',
      flavorProfile: typeof cocktail.flavorProfile === 'string' ? cocktail.flavorProfile : '',
      ingredients: Array.isArray(cocktail.ingredients)
        ? cocktail.ingredients.map(normalizeIngredient).filter(Boolean)
        : [],
      instructions: typeof cocktail.instructions === 'string' ? cocktail.instructions : '',
      image: typeof cocktail.image === 'string' && cocktail.image ? cocktail.image : null,
    };
  }

  function toSeed(cocktail) {
    return { ...cocktail, id: `seed:${slugify(cocktail.name)}`, origin: 'seed' };
  }

  function toUserCocktail(cocktail) {
    return { ...cocktail, id: `user:${slugify(cocktail.name)}:${Date.now().toString(36)}`, origin: 'user' };
  }

  function readUserCocktails() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      loadError = 'Local storage is not available in this browser.';
      return [];
    }

    if (!raw) return [];

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (error) {
      loadError = 'Saved cocktails could not be read and were ignored.';
      return [];
    }

    // No versioned payload yet: treat a bare array as version 1 so the very first
    // save does not need a migration branch.
    const list = Array.isArray(payload) ? payload : payload.cocktails;
    const version = Array.isArray(payload) ? SCHEMA_VERSION : payload.schemaVersion;

    if (version !== SCHEMA_VERSION) {
      // Migration hook: see "Changing the shape" in the header comment above. Until a
      // branch exists for a given version the data is dropped rather than fed into the
      // app in a shape it does not recognise.
      loadError = `Saved cocktails use schema v${version}, this app expects v${SCHEMA_VERSION}. They were not loaded.`;
      return [];
    }

    return (Array.isArray(list) ? list : []).map(normalizeCocktail).filter(Boolean);
  }

  function writeUserCocktails(cocktails) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ schemaVersion: SCHEMA_VERSION, cocktails })
      );
      return true;
    } catch (error) {
      loadError = 'Cocktails could not be saved. Your browser may be blocking local storage.';
      return false;
    }
  }

  return {
    async load() {
      loadError = null;
      try {
        const response = await fetch('cocktails.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        seeds = data.map(normalizeCocktail).filter(Boolean).map(toSeed);
      } catch (error) {
        seeds = [];
        loadError =
          'Could not load cocktails.json. Serve the folder over http:// ' +
          '(for example with "python -m http.server") - opening the file directly will not work.';
      }
      userCocktails = readUserCocktails().map(toUserCocktail);
      return { cocktails: this.getAll(), error: loadError };
    },

    getAll() {
      return [...seeds, ...userCocktails];
    },

    getError() {
      return loadError;
    },

    /*
     * Adds a user cocktail. Both spiritType and flavorProfile are enforced here so
     * that every stored cocktail is reachable by the generator's filter.
     */
    add(cocktail) {
      const normalized = normalizeCocktail(cocktail);
      if (!normalized) return { ok: false, error: 'A cocktail needs at least a name.' };
      if (!normalized.spiritType) return { ok: false, error: 'Choose a spirit type.' };
      if (!normalized.flavorProfile) return { ok: false, error: 'Choose a flavour profile.' };

      const next = [...userCocktails, toUserCocktail(normalized)];
      if (!writeUserCocktails(next)) {
        return { ok: false, error: loadError };
      }
      userCocktails = next;
      return { ok: true, cocktail: next[next.length - 1] };
    },

    remove(id) {
      const next = userCocktails.filter(cocktail => cocktail.id !== id);
      if (next.length === userCocktails.length) {
        return { ok: false, error: 'That cocktail was not found.' };
      }
      if (!writeUserCocktails(next)) {
        return { ok: false, error: loadError };
      }
      userCocktails = next;
      return { ok: true };
    },
  };
})();

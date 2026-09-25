# Cocktail Generator

Filter by spirit and flavor, and get a random cocktail. You can add your own recipes;
they are saved in your browser. No backend, no build step, no dependencies.

## Running it

```bash
npm start          # http://localhost:8000
```

You need a server rather than just double-clicking `index.html`. The app fetches
`cocktails.json`, which does not work over `file://` — the browser blocks it and the page
stays empty. `npm start` runs `python -m http.server` for you.

## Tests

```bash
npm test
```

Two suites, no browser needed: one for the data model, one that checks the markup and the
scripts agree on ids, tabs and script order. No dependencies, so there is nothing to
install.

## What it does

- **Filter** by spirit type and flavor profile, across the 20 built-in recipes plus
  anything you have added.
- **Generate** a random cocktail from your selection, with ingredients, instructions and
  an image.
- **Add** your own recipes, with an amount for each ingredient.
- **Yours to keep** — your recipes live in your browser and are still there when you
  reopen the page.

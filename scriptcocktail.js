let cocktails = [];

document.getElementById('generate-cocktail').addEventListener('click', generateCocktail);

init();

async function init() {
  const { error } = await cocktailStore.load();
  cocktails = cocktailStore.getAll();

  if (cocktails.length === 0) {
    displayError(error || 'No cocktails could be loaded.');
    return;
  }

  populateSelects();
  populateFormOptions();
  wireForm();
}

function uniqueValues(field) {
  return [...new Set(cocktails.map(cocktail => cocktail[field]))].filter(Boolean).sort();
}


function formatIngredient(ingredient) {
  if (ingredient.amount === null) return ingredient.name;
  const unit = ingredient.unit ? `${ingredient.unit} ` : '';
  return `${ingredient.amount} ${unit}${ingredient.name}`;
}

function populateSelects() {
  buildCheckboxes('spirit-types', 'spirit-type-', uniqueValues('spiritType'));
  buildCheckboxes('flavor-profiles', 'flavor-profile-', uniqueValues('flavorProfile'));
}

function populateFormOptions() {
  fillSelect('new-spirit', uniqueValues('spiritType'));
  fillSelect('new-flavour', uniqueValues('flavorProfile'));
}

function fillSelect(selectId, values) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const placeholder = select.querySelector('option[value=""]');
  select.innerHTML = '';
  if (placeholder) select.appendChild(placeholder);
  values.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function buildCheckboxes(containerId, idPrefix, values) {
  const container = document.getElementById(containerId);
  if (!container) return;

  values.forEach(value => {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `${idPrefix}${value}`;
    checkbox.value = value;

    const label = document.createElement('label');
    label.textContent = value;
    label.htmlFor = checkbox.id;

    container.appendChild(checkbox);
    container.appendChild(label);
  });
}

function getCheckedValues(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  return [...container.getElementsByTagName('input')]
    .filter(checkbox => checkbox.checked)
    .map(checkbox => checkbox.value);
}

function generateCocktail() {
  const selectedSpiritTypes = getCheckedValues('spirit-types');
  const selectedFlavorProfiles = getCheckedValues('flavor-profiles');

  const filteredCocktails = cocktails.filter(cocktail => {
    return selectedSpiritTypes.includes(cocktail.spiritType) && selectedFlavorProfiles.includes(cocktail.flavorProfile);
  });

  if (filteredCocktails.length === 0) {
    displayError('No cocktails match the selected criteria');
  } else {
    const randomCocktail = filteredCocktails[Math.floor(Math.random() * filteredCocktails.length)];
    displayCocktail(randomCocktail);
  }
}

function displayCocktail(cocktail) {
  const cocktailResultElement = document.getElementById('cocktail-result');
  if (!cocktailResultElement) {
    console.error("Element 'cocktail-result' not found!");
    return;
  }

  cocktailResultElement.style.display = 'block';
  document.getElementById('cocktail-name').textContent = cocktail.name;
  document.getElementById('cocktail-ingredients').textContent = cocktail.ingredients
    .map(formatIngredient)
    .join(', ');
  document.getElementById('cocktail-instructions').textContent = cocktail.instructions;

  const cocktailImageElement = document.getElementById('cocktail-image');
  if (cocktail.image) {
    cocktailImageElement.src = cocktail.image;
    cocktailImageElement.alt = `Image of ${cocktail.name}`;
    cocktailImageElement.style.display = 'block';
  } else {
    cocktailImageElement.removeAttribute('src');
    cocktailImageElement.alt = '';
    cocktailImageElement.style.display = 'none';
  }

  document.getElementById('cocktail-error').textContent = '';
}

function displayError(message) {
  const cocktailErrorElement = document.getElementById('cocktail-error');
  const cocktailResultElement = document.getElementById('cocktail-result');
  if (!cocktailErrorElement || !cocktailResultElement) {
    console.error("Element 'cocktail-result' or 'cocktail-error' not found!");
    return;
  }

  cocktailResultElement.style.display = 'block';
  document.getElementById('cocktail-name').textContent = '';
  document.getElementById('cocktail-ingredients').textContent = '';
  document.getElementById('cocktail-instructions').textContent = '';

  const cocktailImageElement = document.getElementById('cocktail-image');
  cocktailImageElement.removeAttribute('src');
  cocktailImageElement.alt = '';
  cocktailImageElement.style.display = 'none';

  cocktailErrorElement.textContent = message;
}


const KNOWN_UNITS = [
  'ml', 'cl', 'dl', 'l', 'tsp', 'tbsp',
  'dash', 'dashes', 'splash', 'splash(es)',
  'slice', 'slices', 'wedge', 'wedges', 'leaf', 'leaves', 'cube', 'cubes', 'sprig', 'sprigs',
];

function parseIngredients(text) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const match = line.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
      if (!match) return { name: line, amount: null, unit: null };

      const amount = Number(match[1].replace(',', '.'));
      const rest = match[2].trim();

      const unitMatch = rest.match(/^(\S+)\s+(.+)$/);
      if (unitMatch && KNOWN_UNITS.includes(unitMatch[1].toLowerCase())) {
        return { name: unitMatch[2], amount, unit: unitMatch[1] };
      }
      return { name: rest, amount, unit: null };
    });
}

function wireForm() {
  const form = document.getElementById('cocktail-form');
  if (!form) return;

  form.addEventListener('submit', event => {
    event.preventDefault();
    const formError = document.getElementById('form-error');
    formError.textContent = '';

    const data = new FormData(form);
    const result = cocktailStore.add({
      name: data.get('name'),
      spiritType: data.get('spiritType'),
      flavorProfile: data.get('flavorProfile'),
      ingredients: parseIngredients(data.get('ingredients') || ''),
      instructions: data.get('instructions') || '',
    });

    if (!result.ok) {
      formError.textContent = result.error;
      return;
    }

    cocktails = cocktailStore.getAll();
    form.reset();
    populateFormOptions();
    revealCocktail(result.cocktail);
  });
}


function revealCocktail(cocktail) {
  const spiritBox = document.getElementById(`spirit-type-${cocktail.spiritType}`);
  const flavourBox = document.getElementById(`flavor-profile-${cocktail.flavorProfile}`);
  if (spiritBox) spiritBox.checked = true;
  if (flavourBox) flavourBox.checked = true;
  displayCocktail(cocktail);
  tabs.select('tab-generate');
}

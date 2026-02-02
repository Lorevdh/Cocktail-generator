const cocktails = [];

fetch('cocktails.json')
  .then(response => response.json())
  .then(data => {
    cocktails.push(...data);
    populateSelects();
  });

function populateSelects() {
  const spiritTypes = [...new Set(cocktails.map(cocktail => cocktail.spiritType))];
  const flavorProfiles = [...new Set(cocktails.map(cocktail => cocktail.flavorProfile))];

  spiritTypes.forEach(spiritType => {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `spirit-type-${spiritType}`;
    checkbox.value = spiritType;
    const label = document.createElement('label');
    label.textContent = spiritType;
    label.htmlFor = checkbox.id;
    document.getElementById('spirit-types').appendChild(checkbox);
    document.getElementById('spirit-types').appendChild(label);
  });

  flavorProfiles.forEach(flavorProfile => {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `flavor-profile-${flavorProfile}`;
    checkbox.value = flavorProfile;
    const label = document.createElement('label');
    label.textContent = flavorProfile;
    label.htmlFor = checkbox.id;
    document.getElementById('flavor-profiles').appendChild(checkbox);
    document.getElementById('flavor-profiles').appendChild(label);
  });
}

document.getElementById('generate-cocktail').addEventListener('click', generateCocktail);

function generateCocktail() {
  const selectedSpiritTypes = [];
  const spiritTypeCheckboxes = document.getElementById('spirit-types').getElementsByTagName('input');
  for (let i = 0; i < spiritTypeCheckboxes.length; i++) {
    if (spiritTypeCheckboxes[i].checked) {
      selectedSpiritTypes.push(spiritTypeCheckboxes[i].value);
    }
  }

  const selectedFlavorProfiles = [];
  const flavorProfileCheckboxes = document.getElementById('flavor-profiles').getElementsByTagName('input');
  for (let i = 0; i < flavorProfileCheckboxes.length; i++) {
    if (flavorProfileCheckboxes[i].checked) {
      selectedFlavorProfiles.push(flavorProfileCheckboxes[i].value);
    }
  }

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
  if (cocktailResultElement) {
    cocktailResultElement.style.display = 'block';
    document.getElementById('cocktail-name').textContent = `Name: ${cocktail.name}`;
    document.getElementById('cocktail-ingredients').textContent = `Ingredients: ${cocktail.ingredients.join(', ')}`;
    document.getElementById('cocktail-instructions').textContent = `Instructions: ${cocktail.instructions}`;
    const cocktailImageElement = document.getElementById('cocktail-image');
    if (cocktail.image) { // check if the cocktail has an image
      cocktailImageElement.src = cocktail.image;
      cocktailImageElement.alt = `Image of ${cocktail.name}`;
      cocktailImageElement.style.display = 'block'; // show the img element
    } else {
      cocktailImageElement.src = ''; // reset the src attribute if no image
      cocktailImageElement.alt = ''; // reset the alt attribute if no image
      cocktailImageElement.style.display = 'none'; // hide the img element
    }
    document.getElementById('cocktail-error').textContent = '';
  } else {
    console.error("Element 'cocktail-result' not found!");
  }
}

function displayError(message) {
  const cocktailErrorElement = document.getElementById('cocktail-error');
  const cocktailResultElement = document.getElementById('cocktail-result');
  if (cocktailErrorElement && cocktailResultElement) {
    cocktailResultElement.style.display = 'block';
    document.getElementById('cocktail-name').textContent = '';
    document.getElementById('cocktail-ingredients').textContent = '';
    document.getElementById('cocktail-instructions').textContent = '';
    cocktailErrorElement.textContent = message;
    const cocktailImageElement = document.getElementById('cocktail-image');
    cocktailImageElement.style.display = 'none'; // hide the img element
  } else {
    console.error("Element 'cocktail-result' or 'cocktail-error' not found!");
  }
}
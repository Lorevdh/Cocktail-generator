

const tabs = (() => {
  const tablist = document.querySelector('[role="tablist"]');
  if (!tablist) return { select() {} };

  const tabButtons = [...tablist.querySelectorAll('[role="tab"]')];

  function select(tab) {
    tabButtons.forEach(button => {
      const isSelected = button === tab;
      button.setAttribute('aria-selected', String(isSelected));
      button.tabIndex = isSelected ? 0 : -1;
      const panel = document.getElementById(button.getAttribute('aria-controls'));
      if (panel) panel.hidden = !isSelected;
    });
  }

  tablist.addEventListener('click', event => {
    const tab = event.target.closest('[role="tab"]');
    if (tab) select(tab);
  });

  tablist.addEventListener('keydown', event => {
    const current = tabButtons.indexOf(document.activeElement);
    if (current < 0) return;

    let next;
    switch (event.key) {
      case 'ArrowRight': next = tabButtons[(current + 1) % tabButtons.length]; break;
      case 'ArrowLeft': next = tabButtons[(current - 1 + tabButtons.length) % tabButtons.length]; break;
      case 'Home': next = tabButtons[0]; break;
      case 'End': next = tabButtons[tabButtons.length - 1]; break;
      default: return;
    }

    event.preventDefault();
    select(next);
    next.focus();
  });

  select(tabButtons.find(button => button.getAttribute('aria-selected') === 'true') || tabButtons[0]);

  return {
    select(id) {
      const tab = tabButtons.find(button => button.id === id);
      if (tab) select(tab);
    },
  };
})();

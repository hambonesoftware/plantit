export function PlantCard(plant, options = {}) {
  const { onOpen, onWater, href } = options;
  const card = document.createElement('article');
  card.className = 'card plant-card';
  card.tabIndex = 0;
  card.setAttribute('role', 'link');
  card.innerHTML = `
    <div class="body">
      <h4 class="title">${plant.name}</h4>
      ${plant.species ? `<p class="meta">${plant.species}</p>` : ''}
      <p class="meta">Last watered ${plant.last_watered_human}</p>
      <div class="actions">
        <a class="btn" data-action="open" href="${href || '#'}">View plant</a>
        <button class="link-btn" type="button" data-action="water">Log water</button>
      </div>
    </div>
  `;

  const openLink = card.querySelector('[data-action="open"]');
  const waterBtn = card.querySelector('[data-action="water"]');

  if (openLink) {
    openLink.addEventListener('click', (event) => {
      if (!onOpen) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      event.preventDefault();
      onOpen(plant, { event });
    });
  }

  card.addEventListener('click', (event) => {
    if (event.defaultPrevented) {
      return;
    }
    if (event.target.closest('.actions')) {
      return;
    }
    if (openLink) {
      openLink.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      }));
    } else if (onOpen) {
      onOpen(plant, { event });
    }
  });

  card.addEventListener('keydown', (event) => {
    if (event.target !== card) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (openLink) {
        openLink.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
        }));
      } else if (onOpen) {
        onOpen(plant, { event });
      }
    }
  });

  if (waterBtn) {
    waterBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (onWater) {
        onWater(plant, { button: waterBtn, event });
      }
    });
  }

  return card;
}

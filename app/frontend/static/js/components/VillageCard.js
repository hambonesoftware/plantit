export function VillageCard(vm, handlers = {}) {
  const card = document.createElement('div');
  card.className = 'card village-card';
  card.innerHTML = `
    <div class="img" aria-hidden="true"></div>
    <div class="body">
      <h4 class="title">${vm.name}</h4>
      <div class="row" role="group" aria-label="Task indicators">
        <span class="badge green" role="status" aria-label="${vm.due_today} plants due today">Due today ${vm.due_today}</span>
        <span class="badge ${vm.overdue > 0 ? 'red' : 'gray'}" role="status" aria-label="${vm.overdue > 0 ? vm.overdue + ' plants overdue' : 'No overdue tasks'}">${vm.overdue > 0 ? vm.overdue + ' overdue' : '0 overdue'}</span>
      </div>
      <div class="meta">Last watered ${vm.last_watered_human}</div>
      <div class="actions">
        <button class="btn" type="button" data-action="open">Open</button>
        <button class="btn" type="button" data-action="quick">Quick add plant</button>
      </div>
    </div>
  `;

  const openBtn = card.querySelector('[data-action="open"]');
  openBtn.addEventListener('click', (event) => {
    event.preventDefault();
    if (handlers.onOpen) {
      handlers.onOpen(vm);
    }
  });

  const quickBtn = card.querySelector('[data-action="quick"]');
  const form = document.createElement('form');
  form.className = 'quick-form';
  form.innerHTML = `
    <div class="quick-fields">
      <label>
        <span class="sr-only">Plant name</span>
        <input name="name" type="text" placeholder="Name" required>
      </label>
      <label>
        <span class="sr-only">Species</span>
        <input name="species" type="text" placeholder="Species (optional)">
      </label>
      <label class="freq">
        <span class="sr-only">Water every (days)</span>
        <input name="frequency" type="number" min="1" value="3" aria-label="Water every (days)">
      </label>
      <button class="btn" type="submit">Add</button>
      <button class="link-btn" type="button" data-action="cancel">Cancel</button>
    </div>
    <p class="form-message" aria-live="polite" role="status"></p>
  `;
  const body = card.querySelector('.body');
  body.appendChild(form);

  function toggleForm(show) {
    form.classList.toggle('open', show);
    if (show) {
      form.querySelector('input[name="name"]').focus();
    } else {
      form.reset();
      form.querySelector('.form-message').textContent = '';
    }
  }

  quickBtn.addEventListener('click', () => {
    toggleForm(!form.classList.contains('open'));
  });

  form.querySelector('[data-action="cancel"]').addEventListener('click', () => {
    toggleForm(false);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!handlers.onQuickAdd) {
      toggleForm(false);
      return;
    }

    const nameInput = form.querySelector('input[name="name"]');
    const speciesInput = form.querySelector('input[name="species"]');
    const freqInput = form.querySelector('input[name="frequency"]');
    const message = form.querySelector('.form-message');

    const payload = {
      name: nameInput.value.trim(),
      species: speciesInput.value.trim() || null,
      frequency_days: Number(freqInput.value) || 3,
    };
    if (!payload.name) {
      message.textContent = 'Name is required.';
      nameInput.focus();
      return;
    }

    quickBtn.disabled = true;
    form.classList.add('busy');
    message.textContent = 'Saving…';
    try {
      await handlers.onQuickAdd(vm, payload);
      message.textContent = 'Added!';
      toggleForm(false);
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'Unable to add plant.';
    } finally {
      quickBtn.disabled = false;
      form.classList.remove('busy');
    }
  });

  return card;
}

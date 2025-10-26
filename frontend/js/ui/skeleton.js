const SKELETON_CLASS = "is-skeleton";

function shimmer(element) {
  element.classList.add("skeleton");
  return element;
}

export function createSummarySkeleton(count = 4) {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < count; index += 1) {
    const chip = document.createElement("div");
    chip.className = `home-view__summary-chip ${SKELETON_CLASS}`;
    chip.setAttribute("aria-hidden", "true");
    const value = document.createElement("span");
    value.className = "skeleton-line skeleton-line--value";
    const label = document.createElement("span");
    label.className = "skeleton-line skeleton-line--label";
    shimmer(value);
    shimmer(label);
    chip.appendChild(value);
    chip.appendChild(label);
    fragment.appendChild(chip);
  }
  return fragment;
}

export function createVillageCardSkeletons(count = 3) {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < count; index += 1) {
    const card = document.createElement("article");
    card.className = `village-card village-card--skeleton ${SKELETON_CLASS}`;
    card.setAttribute("aria-hidden", "true");
    const media = shimmer(document.createElement("div"));
    media.className = "village-card__media";
    card.appendChild(media);

    const content = document.createElement("div");
    content.className = "village-card__content";

    const header = document.createElement("header");
    header.className = "village-card__header";
    const titleWrap = document.createElement("div");
    titleWrap.className = "village-card__title";
    const title = shimmer(document.createElement("div"));
    title.classList.add("skeleton-line", "skeleton-line--title");
    const meta = shimmer(document.createElement("div"));
    meta.classList.add("skeleton-line", "skeleton-line--meta");
    titleWrap.appendChild(title);
    titleWrap.appendChild(meta);
    const count = shimmer(document.createElement("div"));
    count.classList.add("skeleton-line", "skeleton-line--count");
    header.appendChild(titleWrap);
    header.appendChild(count);
    content.appendChild(header);

    const chips = document.createElement("div");
    chips.className = "village-card__chips";
    for (let chipIndex = 0; chipIndex < 2; chipIndex += 1) {
      const chip = shimmer(document.createElement("span"));
      chip.classList.add("skeleton-pill");
      chips.appendChild(chip);
    }
    content.appendChild(chips);

    const actions = document.createElement("div");
    actions.className = "village-card__actions";
    const link = shimmer(document.createElement("div"));
    link.classList.add("skeleton-pill");
    link.style.width = "4.5rem";
    const quickAdd = document.createElement("div");
    quickAdd.className = "village-card__quick-add";
    const quickAddInput = shimmer(document.createElement("div"));
    quickAddInput.classList.add("skeleton-line", "skeleton-line--meta");
    quickAddInput.style.flex = "1";
    quickAddInput.style.height = "0.85rem";
    const quickAddButton = shimmer(document.createElement("div"));
    quickAddButton.classList.add("skeleton-pill");
    quickAddButton.style.width = "2.5rem";
    quickAddButton.style.height = "2.5rem";
    quickAdd.appendChild(quickAddInput);
    quickAdd.appendChild(quickAddButton);
    actions.appendChild(link);
    actions.appendChild(quickAdd);
    content.appendChild(actions);

    card.appendChild(content);
    fragment.appendChild(card);
  }
  return fragment;
}

export function createVillageListSkeleton(rows = 4) {
  const table = document.createElement("table");
  table.className = "village-view__table village-view__table--skeleton";
  table.setAttribute("aria-hidden", "true");
  const tbody = document.createElement("tbody");
  for (let index = 0; index < rows; index += 1) {
    const row = document.createElement("tr");
    for (let col = 0; col < 4; col += 1) {
      const cell = document.createElement("td");
      const line = shimmer(document.createElement("div"));
      line.classList.add("skeleton-line");
      cell.appendChild(line);
      row.appendChild(cell);
    }
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  return table;
}

export function createVillageDetailSkeleton() {
  const container = document.createElement("div");
  container.className = "village-view__grid";
  container.setAttribute("aria-hidden", "true");
  container.appendChild(createVillageCardSkeletons(4));
  return container;
}

export function createHomeSkeleton() {
  return {
    summary: createSummarySkeleton(),
    cards: createVillageCardSkeletons(3),
  };
}

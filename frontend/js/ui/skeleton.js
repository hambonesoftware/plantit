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
    media.classList.add("village-card__media");
    card.appendChild(media);

    const content = document.createElement("div");
    content.className = "village-card__content";

    const header = document.createElement("header");
    header.className = "village-card__header";
    const headerText = document.createElement("div");
    const title = shimmer(document.createElement("div"));
    title.classList.add("skeleton-line", "skeleton-line--title");
    const meta = shimmer(document.createElement("div"));
    meta.classList.add("skeleton-line", "skeleton-line--meta");
    headerText.appendChild(title);
    headerText.appendChild(meta);
    const due = document.createElement("span");
    due.className = "village-card__due";
    const dueValue = shimmer(document.createElement("div"));
    dueValue.classList.add("skeleton-line", "skeleton-line--count");
    dueValue.style.width = "2.5rem";
    dueValue.style.height = "1.25rem";
    due.appendChild(dueValue);
    header.appendChild(headerText);
    header.appendChild(due);

    const metrics = document.createElement("div");
    metrics.className = "village-card__metrics";
    const countLine = shimmer(document.createElement("div"));
    countLine.classList.add("skeleton-line", "skeleton-line--count");
    const chips = document.createElement("div");
    chips.className = "village-card__chips";
    for (let chipIndex = 0; chipIndex < 2; chipIndex += 1) {
      const chip = shimmer(document.createElement("span"));
      chip.classList.add("skeleton-pill");
      chips.appendChild(chip);
    }
    metrics.appendChild(countLine);
    metrics.appendChild(chips);

    content.appendChild(header);
    content.appendChild(metrics);
    card.appendChild(content);

    const footer = document.createElement("div");
    footer.className = "village-card__footer";
    const openLink = shimmer(document.createElement("div"));
    openLink.classList.add("skeleton-line", "skeleton-line--meta");
    openLink.style.width = "3.5rem";
    const quickAdd = document.createElement("div");
    quickAdd.className = "village-card__quick-add";
    const quickInput = shimmer(document.createElement("div"));
    quickInput.classList.add("skeleton-line");
    quickInput.style.flex = "1";
    quickInput.style.height = "2.5rem";
    quickInput.style.borderRadius = "var(--radius-md)";
    const quickButton = shimmer(document.createElement("div"));
    quickButton.classList.add("skeleton-line");
    quickButton.style.width = "4rem";
    quickButton.style.height = "2.5rem";
    quickButton.style.borderRadius = "var(--radius-md)";
    quickAdd.appendChild(quickInput);
    quickAdd.appendChild(quickButton);
    footer.appendChild(openLink);
    footer.appendChild(quickAdd);
    card.appendChild(footer);
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

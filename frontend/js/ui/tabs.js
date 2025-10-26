const KEY_LEFT = "ArrowLeft";
const KEY_RIGHT = "ArrowRight";
const KEY_HOME = "Home";
const KEY_END = "End";

function focusTab(tabs, index) {
  const clamped = (index + tabs.length) % tabs.length;
  tabs[clamped].focus();
  tabs[clamped].click();
}

export function initTabs(container) {
  if (!container) {
    return () => {};
  }
  const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
  const panels = Array.from(container.querySelectorAll('[role="tabpanel"]'));
  const tabById = new Map(panels.map((panel) => [panel.id, panel]));

  function activate(tab) {
    const targetId = tab.getAttribute("aria-controls");
    tabs.forEach((current) => {
      const isActive = current === tab;
      current.setAttribute("aria-selected", isActive ? "true" : "false");
      current.tabIndex = isActive ? 0 : -1;
      const panel = tabById.get(current.getAttribute("aria-controls"));
      if (panel) {
        panel.hidden = !isActive;
      }
    });
  }

  function onClick(event) {
    const tab = event.target.closest('[role="tab"]');
    if (!tab) {
      return;
    }
    activate(tab);
  }

  function onKeyDown(event) {
    const currentIndex = tabs.indexOf(document.activeElement);
    if (currentIndex === -1) {
      return;
    }
    if (event.key === KEY_LEFT) {
      event.preventDefault();
      focusTab(tabs, currentIndex - 1);
    } else if (event.key === KEY_RIGHT) {
      event.preventDefault();
      focusTab(tabs, currentIndex + 1);
    } else if (event.key === KEY_HOME) {
      event.preventDefault();
      focusTab(tabs, 0);
    } else if (event.key === KEY_END) {
      event.preventDefault();
      focusTab(tabs, tabs.length - 1);
    }
  }

  container.addEventListener("click", onClick);
  container.addEventListener("keydown", onKeyDown);

  const defaultTab = tabs.find((tab) => tab.getAttribute("aria-selected") === "true") || tabs[0];
  if (defaultTab) {
    activate(defaultTab);
  }

  return () => {
    container.removeEventListener("click", onClick);
    container.removeEventListener("keydown", onKeyDown);
  };
}

export default { initTabs };

import { subscribe } from "../state.js";

const DEFAULT_DURATION = 4500;

export class ToastManager {
  constructor(container = document.getElementById("toast-region")) {
    if (!container) {
      throw new Error("ToastManager requires a container element with id 'toast-region'");
    }
    this.container = container;
    this.toasts = new Set();
    this.unsubscribe = subscribe("toast", (event) => this.show(event));
  }

  show({ message, type = "info", duration = DEFAULT_DURATION, action } = {}) {
    if (!message) {
      return () => {};
    }
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.dataset.type = type;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
    toast.setAttribute("tabindex", "0");

    const text = document.createElement("span");
    text.textContent = message;
    toast.appendChild(text);

    if (action?.label && typeof action.onSelect === "function") {
      const actionButton = document.createElement("button");
      actionButton.type = "button";
      actionButton.textContent = action.label;
      actionButton.addEventListener("click", () => {
        action.onSelect();
        this.dismiss(toast);
      });
      toast.appendChild(actionButton);
    }

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Dismiss notification");
    closeButton.textContent = "✕";
    closeButton.addEventListener("click", () => this.dismiss(toast));
    toast.appendChild(closeButton);

    this.container.appendChild(toast);
    this.toasts.add(toast);
    toast.focus({ preventScroll: true });

    const timeout = window.setTimeout(() => this.dismiss(toast), duration);
    toast.dataset.timeoutId = timeout.toString();

    return () => this.dismiss(toast);
  }

  dismiss(toast) {
    if (!this.toasts.has(toast)) {
      return;
    }
    this.toasts.delete(toast);
    if (toast.dataset.timeoutId) {
      window.clearTimeout(Number(toast.dataset.timeoutId));
    }
    toast.classList.add("toast--leaving");
    toast.addEventListener(
      "transitionend",
      () => {
        toast.remove();
      },
      { once: true },
    );
    toast.remove();
  }

  destroy() {
    this.toasts.forEach((toast) => this.dismiss(toast));
    this.unsubscribe();
  }
}

export function createToastManager(container) {
  return new ToastManager(container);
}

import { emit } from "./state.js";

function compilePath(pattern) {
  const keys = [];
  const regexPattern = pattern
    .replace(/\//g, "\\/")
    .replace(/:(\w+)/g, (_, key) => {
      keys.push(key);
      return "(?<" + key + ">[^/]+)";
    });
  const regex = new RegExp(`^${regexPattern}$`);
  return { regex, keys };
}

export class Router {
  constructor({ outlet, routes = [], notFound }) {
    if (!outlet) {
      throw new Error("Router requires an outlet element");
    }
    this.outlet = outlet;
    this.notFound = notFound || (async () => ({
      mount: () => {
        this.outlet.innerHTML = "<h1>Not Found</h1>";
      },
    }));
    this.routes = [];
    this.currentView = null;
    this.currentPath = null;
    routes.forEach((route) => this.register(route.path, route.loader));

    window.addEventListener("hashchange", () => {
      this.handleNavigation();
    });
    document.addEventListener("DOMContentLoaded", () => this.handleNavigation());
  }

  register(path, loader) {
    const { regex, keys } = compilePath(path);
    this.routes.push({ path, loader, regex, keys });
  }

  async handleNavigation(targetPath) {
    const path = typeof targetPath === "string" ? targetPath : this.getCurrentPath();
    if (this.currentPath === path) {
      return;
    }
    this.currentPath = path;
    const match = this.matchRoute(path);
    const params = match?.params ?? {};
    const route = match?.route;

    if (this.currentView?.unmount) {
      try {
        this.currentView.unmount();
      } catch (error) {
        console.warn("Error unmounting view", error);
      }
    }

    let view;
    try {
      view = route ? await route.loader({ params }) : await this.notFound({ path });
    } catch (error) {
      emit("toast", {
        message: "Unable to load this view. Please try again.",
        type: "error",
      });
      console.error("Router loader failed", error);
      view = await this.notFound({ path, error });
    }

    if (!view) {
      return;
    }

    this.outlet.replaceChildren();
    if (view.mount) {
      view.mount(this.outlet);
    } else if (view.element instanceof HTMLElement) {
      this.outlet.appendChild(view.element);
    } else if (typeof view.render === "function") {
      view.render(this.outlet);
    } else {
      this.outlet.textContent = "";
    }

    this.currentView = view;
    emit("router:navigated", { path, params });
  }

  navigate(path, { replace = false } = {}) {
    if (replace) {
      const hash = path.startsWith("#") ? path : `#${path}`;
      if (window.location.hash === hash) {
        this.handleNavigation(path.startsWith("#") ? path.slice(1) : path);
        return;
      }
      history.replaceState(null, "", hash);
      this.handleNavigation(path.startsWith("#") ? path.slice(1) : path);
    } else {
      window.location.hash = path.startsWith("#") ? path : `#${path}`;
    }
  }

  getCurrentPath() {
    const hash = window.location.hash || "#/";
    return hash.startsWith("#") ? hash.slice(1) : hash;
  }

  matchRoute(path) {
    for (const route of this.routes) {
      const match = route.regex.exec(path);
      if (match) {
        const groups = match.groups || {};
        const params = Object.fromEntries(Object.entries(groups));
        return {
          route,
          params,
        };
      }
    }
    return null;
  }
}

export function createRouter(options) {
  return new Router(options);
}

const PREF_KEY = 'plantit:prefs';

function hasWindow() {
  return typeof window !== 'undefined';
}

function formatRoute(route) {
  if (route.view === 'village' && route.villageId) {
    let hash = `#/villages/${route.villageId}`;
    if (route.plantId) {
      hash += `/plants/${route.plantId}`;
    }
    return hash;
  }
  return '#/dashboard';
}

function parseRoute(hash) {
  if (!hash) {
    return { view: 'dashboard' };
  }
  const trimmed = hash.replace(/^#\/?/, '');
  if (!trimmed) {
    return { view: 'dashboard' };
  }
  const parts = trimmed.split('/').filter(Boolean);
  if (!parts.length) {
    return { view: 'dashboard' };
  }
  if (parts[0] === 'dashboard') {
    return { view: 'dashboard' };
  }
  if (parts[0] === 'villages') {
    const villageId = Number.parseInt(parts[1], 10);
    if (!Number.isFinite(villageId)) {
      return { view: 'dashboard' };
    }
    if (parts[2] === 'plants' && parts[3]) {
      const plantId = Number.parseInt(parts[3], 10);
      return { view: 'village', villageId, plantId: Number.isFinite(plantId) ? plantId : null };
    }
    return { view: 'village', villageId, plantId: null };
  }
  return { view: 'dashboard' };
}

function hasLocalStorage() {
  try {
    return typeof window !== 'undefined' && 'localStorage' in window;
  } catch (error) {
    return false;
  }
}

function readPrefs() {
  if (!hasLocalStorage()) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('Unable to read preferences', error);
    return null;
  }
}

function writePrefs(prefs) {
  if (!hasLocalStorage()) {
    return;
  }
  try {
    window.localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch (error) {
    console.warn('Unable to persist preferences', error);
  }
}

const canStructuredClone = typeof structuredClone === 'function';

function clone(value) {
  if (canStructuredClone) {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

const defaultState = {
  view: 'dashboard',
  selectedVillageId: null,
  selectedPlantId: null,
  loading: {
    dashboard: false,
    village: false,
    plant: false,
    today: false,
  },
  cache: {
    dashboard: null,
    villages: {},
    plants: {},
    today: null,
  },
  prefs: {
    rememberLastView: true,
    lastView: 'dashboard',
    lastVillageId: null,
    todayCollapsed: false,
  },
};

let isUpdatingHash = false;

export const Store = {
  listeners: new Set(),
  state: clone(defaultState),

  init() {
    const persisted = readPrefs();
    if (persisted && typeof persisted === 'object') {
      this.state.prefs = { ...this.state.prefs, ...persisted };
    }

    if (this.state.prefs.rememberLastView) {
      if (this.state.prefs.lastView === 'village' && this.state.prefs.lastVillageId) {
        this.state.view = 'village';
        this.state.selectedVillageId = this.state.prefs.lastVillageId;
      } else {
        this.state.view = this.state.prefs.lastView || 'dashboard';
      }
    }

    if (hasWindow()) {
      const hash = window.location.hash;
      let initialRoute;
      if (hash) {
        initialRoute = parseRoute(hash);
      } else if (this.state.view === 'village' && this.state.selectedVillageId) {
        initialRoute = { view: 'village', villageId: this.state.selectedVillageId, plantId: this.state.selectedPlantId };
      } else {
        initialRoute = { view: 'dashboard' };
      }

      this.applyRoute(initialRoute);

      const expectedHash = formatRoute(initialRoute);
      if (window.location.hash !== expectedHash) {
        isUpdatingHash = true;
        window.location.hash = expectedHash;
        const release = () => { isUpdatingHash = false; };
        if (typeof queueMicrotask === 'function') {
          queueMicrotask(release);
        } else {
          Promise.resolve().then(release);
        }
      }

      window.addEventListener('hashchange', () => {
        if (isUpdatingHash) {
          return;
        }
        this.applyRoute(parseRoute(window.location.hash));
      });
    } else {
      this.emit();
    }
  },

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  },

  emit() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  },

  mutate(mutator) {
    const result = mutator(this.state);
    if (result && result !== this.state) {
      this.state = result;
    }
    writePrefs(this.state.prefs);
    this.emit();
  },

  applyRoute(route) {
    this.mutate((state) => {
      if (route.view === 'village' && route.villageId) {
        state.view = 'village';
        state.selectedVillageId = route.villageId;
        state.selectedPlantId = route.plantId ?? null;
        state.prefs.lastView = 'village';
        state.prefs.lastVillageId = route.villageId;
      } else {
        state.view = 'dashboard';
        state.selectedVillageId = null;
        state.selectedPlantId = null;
        state.prefs.lastView = 'dashboard';
      }
      return state;
    });
  },

  setLoading(key, value) {
    this.mutate((state) => {
      state.loading = { ...state.loading, [key]: value };
      return state;
    });
  },

  setDashboard(vm) {
    this.mutate((state) => {
      state.cache = {
        ...state.cache,
        dashboard: vm,
        today: vm ? { today: vm.today.slice() } : null,
      };
      return state;
    });
  },

  setToday(vm) {
    this.mutate((state) => {
      state.cache = { ...state.cache, today: vm };
      return state;
    });
  },

  setVillage(villageId, vm) {
    this.mutate((state) => {
      state.cache = {
        ...state.cache,
        villages: { ...state.cache.villages, [villageId]: vm },
      };
      return state;
    });
  },

  setPlant(plantId, vm) {
    this.mutate((state) => {
      state.cache = {
        ...state.cache,
        plants: { ...state.cache.plants, [plantId]: vm },
      };
      return state;
    });
  },

  navigateToDashboard() {
    const route = { view: 'dashboard' };
    if (hasWindow()) {
      const target = formatRoute(route);
      if (window.location.hash === target) {
        this.applyRoute(route);
      } else {
        window.location.hash = target;
      }
    } else {
      this.applyRoute(route);
    }
  },

  navigateToVillage(villageId) {
    const route = { view: 'village', villageId, plantId: null };
    if (hasWindow()) {
      const target = formatRoute(route);
      if (window.location.hash === target) {
        this.applyRoute(route);
      } else {
        window.location.hash = target;
      }
    } else {
      this.applyRoute(route);
    }
  },

  openPlant(plantId, villageId) {
    const resolvedVillage = villageId
      || this.state.selectedVillageId
      || this.state.cache.plants[plantId]?.village_id
      || this.state.prefs.lastVillageId;
    const route = resolvedVillage
      ? { view: 'village', villageId: resolvedVillage, plantId }
      : { view: 'dashboard' };
    if (hasWindow()) {
      const target = formatRoute(route);
      if (window.location.hash === target) {
        this.applyRoute(route);
      } else {
        window.location.hash = target;
      }
    } else {
      this.applyRoute(route);
    }
  },

  closePlant() {
    const villageId = this.state.selectedVillageId;
    const route = villageId
      ? { view: 'village', villageId, plantId: null }
      : { view: 'dashboard' };
    if (hasWindow()) {
      const target = formatRoute(route);
      if (window.location.hash === target) {
        this.applyRoute(route);
      } else {
        window.location.hash = target;
      }
    } else {
      this.applyRoute(route);
    }
  },

  setTodayCollapsed(collapsed) {
    this.mutate((state) => {
      state.prefs.todayCollapsed = collapsed;
      return state;
    });
  },
};

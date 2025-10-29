const PREF_KEY = 'plantit:prefs';

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

export const Store = {
  listeners: new Set(),
  state: structuredClone ? structuredClone(defaultState) : JSON.parse(JSON.stringify(defaultState)),

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

    this.emit();
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
    this.mutate((state) => {
      state.view = 'dashboard';
      state.selectedVillageId = null;
      state.prefs.lastView = 'dashboard';
      return state;
    });
  },

  navigateToVillage(villageId) {
    this.mutate((state) => {
      state.view = 'village';
      state.selectedVillageId = villageId;
      state.prefs.lastView = 'village';
      state.prefs.lastVillageId = villageId;
      return state;
    });
  },

  openPlant(plantId) {
    this.mutate((state) => {
      state.selectedPlantId = plantId;
      return state;
    });
  },

  closePlant() {
    this.mutate((state) => {
      state.selectedPlantId = null;
      return state;
    });
  },

  setTodayCollapsed(collapsed) {
    this.mutate((state) => {
      state.prefs.todayCollapsed = collapsed;
      return state;
    });
  },
};

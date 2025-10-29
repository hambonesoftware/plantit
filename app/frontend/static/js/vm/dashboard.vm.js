import {api} from '../apiClient.js';
import {Store} from '../store.js';

export async function refreshDashboard(force = false) {
  const cached = Store.state.cache.dashboard;
  if (cached && !force) {
    return cached;
  }

  Store.setLoading('dashboard', true);
  try {
    const vm = await api.get('/api/vm/dashboard');
    Store.setDashboard(vm);
    return vm;
  } finally {
    Store.setLoading('dashboard', false);
  }
}

export async function refreshToday(force = false) {
  const cached = Store.state.cache.today;
  if (cached && !force) {
    return cached;
  }

  Store.setLoading('today', true);
  try {
    const vm = await api.get('/api/vm/today');
    Store.setToday(vm);
    return vm;
  } finally {
    Store.setLoading('today', false);
  }
}

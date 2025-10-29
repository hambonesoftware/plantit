import {api} from '../apiClient.js';
import {Store} from '../store.js';

export async function refreshVillage(villageId, force = false) {
  const cached = Store.state.cache.villages[villageId];
  if (cached && !force) {
    return cached;
  }

  Store.setLoading('village', true);
  try {
    const vm = await api.get(`/api/vm/village/${villageId}`);
    Store.setVillage(villageId, vm);
    return vm;
  } finally {
    Store.setLoading('village', false);
  }
}

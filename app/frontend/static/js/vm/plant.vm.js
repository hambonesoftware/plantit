import {api} from '../apiClient.js';
import {Store} from '../store.js';

export async function refreshPlant(plantId, force = false) {
  const cached = Store.state.cache.plants[plantId];
  if (cached && !force) {
    return cached;
  }

  Store.setLoading('plant', true);
  try {
    const vm = await api.get(`/api/vm/plant/${plantId}`);
    Store.setPlant(plantId, vm);
    return vm;
  } finally {
    Store.setLoading('plant', false);
  }
}

import {api} from '../apiClient.js';
import {Store} from '../store.js';

const pendingRequests = new Map();

export async function refreshVillage(villageId, force = false) {
  const cached = Store.state.cache.villages[villageId];
  if (cached && !force) {
    return cached;
  }

  if (pendingRequests.has(villageId)) {
    if (!force) {
      return pendingRequests.get(villageId);
    }
    try {
      await pendingRequests.get(villageId);
    } catch (error) {
      // ignore errors from the previous attempt; we'll retry below
    }
  }

  const request = (async () => {
    Store.setLoading('village', true);
    try {
      const vm = await api.get(`/api/vm/village/${villageId}`);
      Store.setVillage(villageId, vm);
      return vm;
    } finally {
      pendingRequests.delete(villageId);
      Store.setLoading('village', false);
    }
  })();

  pendingRequests.set(villageId, request);
  return request;
}

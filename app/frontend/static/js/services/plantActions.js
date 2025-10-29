import {api} from '../apiClient.js';
import {Store} from '../store.js';

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

function markWatered(villageId, plantId) {
  Store.mutate((state) => {
    const village = state.cache.villages[villageId];
    if (village) {
      const plant = village.plants.find((p) => p.id === plantId);
      if (plant) {
        plant.last_watered_human = 'today';
      }
    }
    const dashboard = state.cache.dashboard;
    if (dashboard) {
      const card = dashboard.villages.find((v) => v.id === villageId);
      if (card) {
        card.last_watered_human = 'today';
      }
    }
    const plantVm = state.cache.plants[plantId];
    if (plantVm) {
      plantVm.last_watered_human = 'today';
    }
    return state;
  });
}

export async function performWaterAction(plantId, villageId, payload = {}) {
  const previousVillage = clone(Store.state.cache.villages[villageId]);
  const previousDashboard = clone(Store.state.cache.dashboard);
  const previousPlant = clone(Store.state.cache.plants[plantId]);

  markWatered(villageId, plantId);

  try {
    const result = await api.post(`/api/plants/${plantId}/water`, payload);
    if (result.plant) {
      Store.setPlant(plantId, result.plant);
    }
    if (result.village) {
      Store.setVillage(villageId, result.village);
    }
    if (result.dashboard) {
      Store.setDashboard(result.dashboard);
    }
    if (result.today) {
      Store.setToday(result.today);
    }
    return result;
  } catch (error) {
    if (previousVillage) {
      Store.setVillage(villageId, previousVillage);
    }
    if (previousDashboard) {
      Store.setDashboard(previousDashboard);
    }
    if (previousPlant) {
      Store.setPlant(plantId, previousPlant);
    }
    throw error instanceof Error ? error : new Error(String(error));
  }
}

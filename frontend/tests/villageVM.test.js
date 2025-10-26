import test from "node:test";
import assert from "node:assert/strict";
import { VillageVM } from "../js/viewmodels/VillageVM.js";

const samplePlants = [
  {
    id: 1,
    name: "Rosemary",
    species: "Rosmarinus officinalis",
    tags: ["herb", "perennial"],
    due_state: "due",
    last_watered_at: "2025-01-10T08:00:00Z",
  },
  {
    id: 2,
    name: "Fern",
    species: "Boston",
    tags: ["shade"],
    due_state: "overdue",
    last_watered_at: null,
  },
];

const sampleVillages = [
  { id: 1, name: "Evergreen Grove", plant_count: 2, due_today: 1, overdue: 1 },
  { id: 2, name: "Sunny Patch", plant_count: 5, due_today: 0, overdue: 0 },
];

function createApiStub() {
  let moved = false;
  return {
    async get(path) {
      if (path.startsWith("/plants")) {
        return { data: moved ? [samplePlants[0]] : samplePlants };
      }
      if (path === "/dashboard") {
        return { data: { villages: sampleVillages } };
      }
      throw new Error(`Unexpected GET ${path}`);
    },
    async post(path, payload) {
      if (path.endsWith(":move")) {
        moved = true;
        return { data: { success: true, payload } };
      }
      return { data: { ok: true, path, payload } };
    },
  };
}

test("load populates plants, tags, and metrics", async () => {
  const vm = new VillageVM({ apiClient: createApiStub(), villageId: 1 });
  let state;
  const unsubscribe = vm.subscribe((snapshot) => {
    state = snapshot;
  });
  await vm.load();
  assert.equal(state.plants.length, 2);
  assert.deepEqual(state.tags, ["herb", "perennial", "shade"].sort());
  assert.equal(state.metrics.total, 2);
  assert.equal(state.metrics.shown, 2);
  assert.equal(state.village.name, "Evergreen Grove");
  unsubscribe();
});

test("filters update without refetch", async () => {
  const api = createApiStub();
  const vm = new VillageVM({ apiClient: api, villageId: 1 });
  await vm.load();
  vm.setFilter("tag", "shade");
  let snapshot = vm.snapshot();
  assert.equal(snapshot.filteredPlants.length, 1);
  assert.equal(snapshot.filteredPlants[0].name, "Fern");
  vm.setFilter("due", "due");
  snapshot = vm.snapshot();
  assert.equal(snapshot.filteredPlants.length, 0);
});

test("movePlant removes plant after success", async () => {
  const api = createApiStub();
  const vm = new VillageVM({ apiClient: api, villageId: 1 });
  let state;
  vm.subscribe((snapshot) => {
    state = snapshot;
  });
  await vm.load();
  await vm.movePlant(2, 2);
  assert.equal(state.plants.length, 1);
  assert.equal(state.plants[0].id, 1);
});

test("logWater triggers API call and clears pending", async () => {
  const api = createApiStub();
  const vm = new VillageVM({ apiClient: api, villageId: 1 });
  await vm.load();
  await vm.logWater(1);
  const snapshot = vm.snapshot();
  assert.equal(snapshot.pending.watering.length, 0);
});

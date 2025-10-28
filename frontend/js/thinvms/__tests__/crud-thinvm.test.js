import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { VillagesThinVM } from "../VillagesThinVM.js";
import { VillageDetailThinVM } from "../VillageDetailThinVM.js";
import { PlantDetailThinVM } from "../PlantDetailThinVM.js";
import { clearCache } from "../../services/apiClient.js";

const originalFetch = global.fetch;

beforeEach(() => {
  clearCache();
  global.fetch = originalFetch;
});

afterEach(() => {
  clearCache();
  global.fetch = originalFetch;
});

test("VillagesThinVM.updateVillage surfaces backend errors", async () => {
  global.fetch = async () =>
    new Response(
      JSON.stringify({ error: { message: "Invalid name" } }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );

  const vm = new VillagesThinVM();
  const states = [];
  vm.subscribe((state) => states.push(structuredClone(state)));

  await assert.rejects(() => vm.updateVillage("v1", { name: "" }), /Invalid name/);
  assert.equal(states.at(-1).error, "Invalid name");
});

test("VillageDetailThinVM.deleteVillage clears state", async () => {
  const responses = [new Response(null, { status: 204 })];
  let calls = 0;
  global.fetch = async () => responses[calls++];

  const vm = new VillageDetailThinVM("v1");
  vm.state = {
    loading: false,
    error: null,
    notice: null,
    data: {
      village: { id: "v1", name: "Village", location: "", description: "" },
      plants: [],
    },
  };

  await vm.deleteVillage();
  assert.equal(vm.state.data.village, null);
  assert.deepEqual(vm.state.data.plants, []);
});

test("PlantDetailThinVM.deletePlant returns village id and clears plant", async () => {
  const responses = [new Response(null, { status: 204 })];
  let calls = 0;
  global.fetch = async () => responses[calls++];

  const vm = new PlantDetailThinVM("p1");
  vm.state = {
    loading: false,
    error: null,
    notice: null,
    data: {
      plant: {
        id: "p1",
        village_id: "v1",
        name: "Fern",
        species: "",
        notes: "",
        tags: [],
        photos: [],
      },
    },
  };

  const villageId = await vm.deletePlant();
  assert.equal(villageId, "v1");
  assert.equal(vm.state.data.plant, null);
});

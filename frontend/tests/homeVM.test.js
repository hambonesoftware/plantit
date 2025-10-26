import test from "node:test";
import assert from "node:assert/strict";
import { HomeVM } from "../js/viewmodels/HomeVM.js";

const dashboardSample = {
  villages: [
    {
      id: 1,
      name: "Evergreen Grove",
      plant_count: 3,
      due_today: 2,
      overdue: 1,
      last_watered_days: 1,
      cover_photo: null,
    },
    {
      id: 2,
      name: "Sunny Patch",
      plant_count: 2,
      due_today: 1,
      overdue: 0,
      last_watered_days: 4,
      cover_photo: null,
    },
  ],
  today: [
    {
      id: 10,
      title: "Water Monstera",
      due_date: "2025-01-15",
      plant: { id: 5, name: "Monstera" },
      village: { id: 1, name: "Evergreen Grove" },
    },
  ],
  calendar: [
    { date: "2025-01-15", count: 2 },
    { date: "2025-01-16", count: 1 },
  ],
};

function cloneDashboard(source = dashboardSample) {
  return JSON.parse(JSON.stringify(source));
}

test("loadDashboard populates metrics and state", async () => {
  let captured;
  const vm = new HomeVM({
    apiClient: {
      async get() {
        return { data: cloneDashboard() };
      },
    },
  });
  const unsubscribe = vm.subscribe((state) => {
    captured = state;
  });

  await vm.loadDashboard();

  assert.equal(captured.villages.length, 2);
  assert.equal(captured.metrics.totalVillages, 2);
  assert.equal(captured.metrics.totalPlants, 5);
  assert.equal(captured.metrics.dueToday, 3);
  assert.equal(captured.metrics.overdue, 1);
  assert.equal(captured.today.length, 1);
  unsubscribe();
});

test("quickAddPlant optimistically increments counts and refreshes", async () => {
  let call = 0;
  const vm = new HomeVM({
    apiClient: {
      async get() {
        call += 1;
        if (call === 1) {
          return { data: cloneDashboard() };
        }
        const updated = cloneDashboard();
        updated.villages[0].plant_count += 1;
        return { data: updated };
      },
      async post() {
        return { data: { id: 42, name: "Mint" } };
      },
    },
  });

  let latest;
  const unsubscribe = vm.subscribe((state) => {
    latest = state;
  });

  await vm.loadDashboard();
  await vm.quickAddPlant(1, { name: "Mint" });

  const updatedVillage = latest.villages.find((village) => village.id === 1);
  assert.ok(updatedVillage);
  assert.equal(updatedVillage.plant_count, 4);
  assert.equal(latest.metrics.totalPlants, 6);
  unsubscribe();
});

test("createVillage posts payload and refreshes dashboard", async () => {
  let getCalls = 0;
  const vm = new HomeVM({
    apiClient: {
      async get() {
        getCalls += 1;
        return { data: cloneDashboard() };
      },
      async post(path, data, options) {
        assert.equal(path, "/villages");
        assert.equal(data.name, "Seedling");
        assert.equal(data.description, "Window");
        assert.equal(options.metadata.action, "village:create");
        assert.equal(options.optimisticData.name, "Seedling");
        assert.equal(options.optimisticData.description, "Window");
        assert.equal(options.optimisticData.plant_count, 0);
        return { data: { id: 3, name: data.name }, queued: false };
      },
    },
  });

  await vm.loadDashboard();
  await vm.createVillage({ name: "Seedling", description: "Window" });

  assert.equal(getCalls, 2);
  assert.equal(vm.snapshot().pending.creatingVillage, false);
});

test("createVillage does not reload when request is queued", async () => {
  let getCalls = 0;
  const vm = new HomeVM({
    apiClient: {
      async get() {
        getCalls += 1;
        return { data: cloneDashboard() };
      },
      async post() {
        return { data: null, queued: true };
      },
    },
  });

  await vm.loadDashboard();
  await vm.createVillage({ name: "Offline" });

  assert.equal(getCalls, 1);
  const snapshot = vm.snapshot();
  assert.equal(snapshot.villages.length, 3);
  const optimistic = snapshot.villages.find((village) => village.optimistic);
  assert.ok(optimistic);
  assert.equal(optimistic.name, "Offline");
  assert.equal(optimistic.plant_count, 0);
  assert.equal(snapshot.metrics.totalVillages, 3);
});

test("completeTask removes task and updates metrics", async () => {
  let call = 0;
  const vm = new HomeVM({
    apiClient: {
      async get() {
        call += 1;
        if (call === 1) {
          return { data: cloneDashboard() };
        }
        const updated = cloneDashboard();
        updated.today = [];
        updated.villages[0].due_today = 1;
        return { data: updated };
      },
      async post() {
        throw new Error("not used");
      },
      async patch() {
        return { data: { id: 10, state: "completed" } };
      },
    },
  });

  let latest;
  const unsubscribe = vm.subscribe((state) => {
    latest = state;
  });

  await vm.loadDashboard();
  await vm.completeTask(10);

  assert.equal(latest.today.length, 0);
  assert.equal(latest.metrics.dueToday, 2);
  assert.equal(latest.pending.tasks.length, 0);
  unsubscribe();
});

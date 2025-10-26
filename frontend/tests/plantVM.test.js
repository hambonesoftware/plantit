import test from "node:test";
import assert from "node:assert/strict";
import { PlantVM } from "../js/viewmodels/PlantVM.js";

const sampleDetail = {
  id: 1,
  village_id: 1,
  name: "Fern",
  species: "Boston",
  tags: ["shade"],
  care_profile: {
    watering_interval_days: null,
    feeding_interval_days: null,
    pruning_interval_days: null,
    misting_interval_days: null,
    notes: null,
    updated_at: null,
  },
  metrics: {
    due_tasks: 0,
    overdue_tasks: 0,
    last_logged_at: null,
  },
  hero_photo: null,
  tasks: [],
  logs: [],
  photos: [],
};

function createApiStub() {
  const calls = [];
  return {
    calls,
    async get(path) {
      calls.push({ method: "get", path });
      if (path.startsWith("/plants/")) {
        return { data: sampleDetail };
      }
      throw new Error(`Unexpected GET ${path}`);
    },
    async patch(path, payload) {
      calls.push({ method: "patch", path, payload });
      return { data: { ...sampleDetail, ...payload } };
    },
    async put(path, payload) {
      calls.push({ method: "put", path, payload });
      return { data: { ...sampleDetail, care_profile: { ...sampleDetail.care_profile, ...payload }, tasks: [{ id: 7, title: "Water", category: "watering" }] } };
    },
    async post(path, payload) {
      calls.push({ method: "post", path, payload });
      if (path.endsWith("/logs")) {
        return { data: { id: 10, action: payload.action, notes: payload.notes, performed_at: "2025-01-02T12:00:00Z" } };
      }
      if (path.endsWith("/tasks")) {
        return { data: { id: 11, title: payload.title, category: payload.category, due_date: payload.due_date } };
      }
      if (path.includes("/photos")) {
        return { data: { id: 20, thumbnail_path: "2025/01/thumb.jpg", caption: payload?.caption ?? null } };
      }
      throw new Error(`Unexpected POST ${path}`);
    },
    async delete(path) {
      calls.push({ method: "delete", path });
      return { data: null };
    },
  };
}

test("load fetches plant detail", async () => {
  const api = createApiStub();
  const vm = new PlantVM({ apiClient: api, plantId: 1 });
  await vm.load();
  const snapshot = vm.snapshot();
  assert.equal(snapshot.detail.name, "Fern");
  assert.equal(api.calls[0].path, "/plants/1");
});

test("saveOverview updates detail", async () => {
  const api = createApiStub();
  const vm = new PlantVM({ apiClient: api, plantId: 1 });
  await vm.load();
  await vm.saveOverview({ name: "Updated" });
  const snapshot = vm.snapshot();
  assert.equal(snapshot.detail.name, "Updated");
});

test("saveCareProfile refreshes tasks", async () => {
  const api = createApiStub();
  const vm = new PlantVM({ apiClient: api, plantId: 1 });
  await vm.load();
  await vm.saveCareProfile({ watering_interval_days: 3 });
  const snapshot = vm.snapshot();
  assert.equal(snapshot.detail.tasks.length, 1);
  assert.equal(snapshot.detail.tasks[0].title, "Water");
});

test("addLog prepends entry", async () => {
  const api = createApiStub();
  const vm = new PlantVM({ apiClient: api, plantId: 1 });
  await vm.load();
  await vm.addLog({ action: "watered", notes: "Weekly" });
  const snapshot = vm.snapshot();
  assert.equal(snapshot.detail.logs.length, 1);
  assert.equal(snapshot.detail.logs[0].action, "watered");
});

test("completeTask removes task", async () => {
  const api = createApiStub();
  const vm = new PlantVM({ apiClient: api, plantId: 1 });
  await vm.load();
  vm.state.detail.tasks = [{ id: 99, title: "Feed", category: "feeding" }];
  vm.state.detail.metrics = { due_tasks: 1 };
  await vm.completeTask(99);
  const snapshot = vm.snapshot();
  assert.equal(snapshot.detail.tasks.length, 0);
  assert.equal(snapshot.detail.metrics.due_tasks, 0);
  assert.equal(api.calls.at(-1).path, "/tasks/99");
});

test("uploadPhoto posts multipart payload and stores result", async () => {
  const api = createApiStub();
  const vm = new PlantVM({ apiClient: api, plantId: 1 });
  await vm.load();
  const file =
    typeof File === "function"
      ? new File(["image"], "growth.png", { type: "image/png" })
      : new Blob(["image"], { type: "image/png" });
  await vm.uploadPhoto(file, { caption: "Growth" });
  const snapshot = vm.snapshot();
  assert.equal(snapshot.pending.uploads.length, 0);
  assert.equal(snapshot.detail.photos.length, 1);
  assert.equal(snapshot.detail.photos[0].id, 20);
  const uploadCall = api.calls.find((call) => call.method === "post" && call.path === "/plants/1/photos");
  assert.ok(uploadCall);
  assert.ok(uploadCall.payload instanceof FormData);
  assert.equal(uploadCall.payload.get("caption"), "Growth");
  const fileEntry = uploadCall.payload.get("file");
  assert.ok(fileEntry);
});

test("deletePhoto removes photo and hits API", async () => {
  const api = createApiStub();
  const vm = new PlantVM({ apiClient: api, plantId: 1 });
  await vm.load();
  vm.state.detail.photos = [{ id: 7, thumbnail_path: "thumb.jpg", caption: null }];
  vm.state.detail.hero_photo = { id: 7, thumbnail_path: "thumb.jpg", caption: null };
  await vm.deletePhoto(7);
  const snapshot = vm.snapshot();
  assert.equal(snapshot.pending.deletes.length, 0);
  assert.equal(snapshot.detail.photos.length, 0);
  assert.equal(snapshot.detail.hero_photo, null);
  const deleteCall = api.calls.find((call) => call.method === "delete" && call.path === "/photos/7");
  assert.ok(deleteCall);
});

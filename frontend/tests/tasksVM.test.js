import test from "node:test";
import assert from "node:assert/strict";
import { TasksVM } from "../js/viewmodels/TasksVM.js";

const sampleTasks = [
  { id: 1, title: "Water basil", state: "pending", category: "watering", due_date: "2025-01-10", plant: { id: 1, name: "Basil" } },
  { id: 2, title: "Inspect fig", state: "pending", category: "inspection", due_date: "2025-01-12", plant: { id: 2, name: "Fig" } },
];

function createApiStub() {
  const calls = [];
  return {
    calls,
    async get(path) {
      calls.push({ method: "get", path });
      return { data: sampleTasks };
    },
    async patch(path, payload) {
      calls.push({ method: "patch", path, payload });
      return { data: { ...sampleTasks[0], ...payload } };
    },
    async post(path, payload) {
      calls.push({ method: "post", path, payload });
      return { data: sampleTasks };
    },
  };
}

test("load fetches tasks and updates state", async () => {
  const api = createApiStub();
  const vm = new TasksVM({ apiClient: api });
  await vm.load();
  const snapshot = vm.snapshot();
  assert.equal(snapshot.tasks.length, 2);
  assert.equal(api.calls[0].path, "/tasks");
});

test("completeTask calls API and refreshes", async () => {
  const api = createApiStub();
  const vm = new TasksVM({ apiClient: api });
  await vm.load();
  vm.selected.add(1);
  await vm.completeTask(1);
  const snapshot = vm.snapshot();
  assert.equal(snapshot.selected.length, 0);
  assert.equal(api.calls.find((call) => call.method === "patch").path, "/tasks/1");
});

test("batchReschedule posts and reloads", async () => {
  const api = createApiStub();
  const vm = new TasksVM({ apiClient: api });
  await vm.load();
  vm.selectAll();
  await vm.batchReschedule("2025-01-20");
  assert.ok(api.calls.some((call) => call.method === "post" && call.path === "/tasks/batch"));
  const payload = api.calls.find((call) => call.method === "post" && call.path === "/tasks/batch").payload;
  assert.equal(payload.due_date, "2025-01-20");
});

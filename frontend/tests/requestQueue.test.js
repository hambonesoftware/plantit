import test from "node:test";
import assert from "node:assert/strict";
import { RequestQueue } from "../js/services/requestQueue.js";
import { APIClient } from "../js/services/apiClient.js";
import { subscribe, clearAllListeners } from "../js/state.js";

function createResponse(status = 200, body = "{}", headers = { "Content-Type": "application/json" }) {
  return new Response(body, { status, headers });
}

function clearQueueTimer(queue) {
  if (queue.timer) {
    clearTimeout(queue.timer);
    queue.timer = null;
  }
}

test("RequestQueue processes memory entries and emits success", async () => {
  clearAllListeners();
  const calls = [];
  const queue = new RequestQueue({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return createResponse(200);
    },
  });
  await queue.init();
  const events = [];
  const release = subscribe("requestQueue:success", (payload) => events.push(payload));
  await queue.enqueue({
    method: "POST",
    path: "/api/v1/tasks/1",
    body: JSON.stringify({ state: "completed" }),
    headers: { "Content-Type": "application/json" },
  });
  await queue.process();
  clearQueueTimer(queue);
  assert.equal(calls.length, 1);
  assert.equal(events.length, 1);
  assert.equal(events[0].path, "/api/v1/tasks/1");
  release();
});

test("RequestQueue retries after failure", async () => {
  clearAllListeners();
  let attempt = 0;
  const queue = new RequestQueue({
    fetchImpl: async () => {
      attempt += 1;
      if (attempt === 1) {
        throw new Error("network down");
      }
      return createResponse(200);
    },
  });
  await queue.init();
  await queue.enqueue({ method: "DELETE", path: "/api/v1/photos/9" });
  await queue.process();
  assert.equal(attempt, 1);
  assert.equal(queue.memoryStore.length, 1);
  queue.memoryStore[0].nextAttempt = Date.now() - 10;
  await queue.process();
  clearQueueTimer(queue);
  assert.equal(attempt, 2);
  assert.equal(queue.memoryStore.length, 0);
});

test("APIClient queues mutation when offline", async () => {
  clearAllListeners();
  const queue = new RequestQueue({ fetchImpl: async () => createResponse(204) });
  await queue.init();
  global.navigator = { onLine: false };
  const client = new APIClient({ baseUrl: "", requestQueue: queue, fetchImpl: async () => createResponse(200) });
  const result = await client.patch("/tasks/55", { state: "completed" });
  const stored = await queue._getAll();
  clearQueueTimer(queue);
  assert.equal(result.queued, true);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].method, "PATCH");
  delete global.navigator;
});

test("APIClient binds global fetch implementation", async () => {
  clearAllListeners();
  const originalFetch = global.fetch;
  let callCount = 0;
  global.fetch = function boundRequiredFetch(...args) {
    callCount += 1;
    if (this !== globalThis) {
      throw new TypeError("Illegal invocation");
    }
    return createResponse(200);
  };

  try {
    const client = new APIClient({ baseUrl: "" });
    const response = await client.get("/ping");
    assert.equal(response.status, 200);
    assert.equal(callCount, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

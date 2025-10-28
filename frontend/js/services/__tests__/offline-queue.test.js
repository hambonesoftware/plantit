import { test } from "node:test";
import assert from "node:assert/strict";

import { OfflineQueue } from "../offlineQueue.js";

class TestPersistence {
  constructor() {
    this.store = new Map();
  }

  async getAll() {
    return Array.from(this.store.values()).map((value) => ({ ...value }));
  }

  async put(entry) {
    this.store.set(entry.id, { ...entry });
  }

  async update(entry) {
    this.store.set(entry.id, { ...entry });
  }

  async delete(id) {
    this.store.delete(id);
  }
}

test("processes queued request when online", async () => {
  const persistence = new TestPersistence();
  const calls = [];
  const fetchFn = async (input, init) => {
    calls.push({ input, init });
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const queue = new OfflineQueue({
    fetchFn,
    persistence,
    isOnline: () => true,
    retryDelays: [5],
  });

  const { completion } = await queue.enqueue({
    url: "https://example.test/api", 
    method: "POST",
    headers: new Headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ name: "Fern" }),
    resources: [],
  });

  await completion;
  assert.equal(calls.length, 1);
  const stored = await persistence.getAll();
  assert.equal(stored.length, 0);
});

test("retries a failed mutation before succeeding", async () => {
  const persistence = new TestPersistence();
  let attempt = 0;
  const fetchFn = async () => {
    attempt += 1;
    if (attempt === 1) {
      throw new Error("offline");
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const queue = new OfflineQueue({
    fetchFn,
    persistence,
    isOnline: () => true,
    retryDelays: [5],
  });

  const { completion } = await queue.enqueue({
    url: "https://example.test/api", 
    method: "DELETE",
    headers: new Headers(),
    body: null,
    resources: [],
  });

  // Allow the initial attempt to fail.
  await new Promise((resolve) => setTimeout(resolve, 15));
  // Wait for retry to complete.
  await completion;
  assert.equal(attempt, 2);
});

test("rejects when server returns a client error", async () => {
  const persistence = new TestPersistence();
  const queue = new OfflineQueue({
    fetchFn: async () =>
      new Response(
        JSON.stringify({ error: { message: "Conflict" } }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        },
      ),
    persistence,
    isOnline: () => true,
    retryDelays: [5],
  });

  const { completion } = await queue.enqueue({
    url: "https://example.test/api", 
    method: "PATCH",
    headers: new Headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ name: "Fern" }),
    resources: [],
  });

  await assert.rejects(completion, /Conflict/);
  const stored = await persistence.getAll();
  assert.equal(stored.length, 0);
});
